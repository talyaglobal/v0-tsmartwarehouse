const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function parseDotEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const obj = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    let val = trimmed.slice(idx + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    obj[key] = val;
  }
  return obj;
}

const root = path.resolve(__dirname, '..');
const envCandidates = [path.join(root, '.env.local'), path.join(root, '.env')];
const envPath = envCandidates.find((p) => fs.existsSync(p)) || envCandidates[0];
const env = Object.assign({}, process.env, parseDotEnv(envPath));
let dbUrl = env.DATABASE_URL;

if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found in .env or environment.');
  process.exit(1);
}

let host, port, user, password, database;
try {
  const url = new URL(dbUrl);
  host = url.hostname;
  port = url.port || '5432';
  user = url.username;
  password = url.password;
  database = url.pathname.slice(1) || 'postgres';
} catch (e) {
  const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!urlMatch) {
    console.error('ERROR: Invalid DATABASE_URL format.');
    process.exit(1);
  }
  [, user, password, host, port, database] = urlMatch;
}

const client = new Client({
  host,
  port: parseInt(port),
  user,
  password,
  database,
  ssl: { rejectUnauthorized: false }
});

const results = {
  timestamp: new Date().toISOString(),
  tests: []
};

async function testPostGIS() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');
    results.connection = 'success';

    // Test 1: Check PostGIS version
    console.log('1. Checking PostGIS extension...');
    try {
      const result1 = await client.query('SELECT PostGIS_Version() as version;');
      console.log('✅ PostGIS is enabled');
      console.log('   Version:', result1.rows[0].version);
      results.tests.push({
        name: 'PostGIS Extension',
        status: 'PASS',
        details: { version: result1.rows[0].version }
      });
    } catch (error) {
      console.log('❌ PostGIS extension is NOT enabled');
      console.log('   Error:', error.message);
      results.tests.push({
        name: 'PostGIS Extension',
        status: 'FAIL',
        error: error.message,
        fix: 'Run: CREATE EXTENSION IF NOT EXISTS postgis;'
      });
    }
    console.log('');

    // Test 2: Check location column
    console.log('2. Checking location column in warehouses table...');
    try {
      const result2 = await client.query(`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns 
        WHERE table_name = 'warehouses' AND column_name = 'location';
      `);
      if (result2.rows.length > 0) {
        console.log('✅ Location column exists');
        console.log('   Column:', result2.rows[0].column_name);
        console.log('   Type:', result2.rows[0].data_type);
        console.log('   UDT:', result2.rows[0].udt_name);
        results.tests.push({
          name: 'Location Column',
          status: 'PASS',
          details: {
            column: result2.rows[0].column_name,
            data_type: result2.rows[0].data_type,
            udt_name: result2.rows[0].udt_name
          }
        });
      } else {
        console.log('❌ Location column does NOT exist');
        results.tests.push({
          name: 'Location Column',
          status: 'FAIL',
          error: 'Location column not found',
          fix: 'Run migration 107 to add location column'
        });
      }
    } catch (error) {
      console.log('❌ Error checking location column:', error.message);
      results.tests.push({
        name: 'Location Column',
        status: 'ERROR',
        error: error.message
      });
    }
    console.log('');

    // Test 3: Check geographic search function
    console.log('3. Checking geographic search function...');
    try {
      const result3 = await client.query(`
        SELECT 
          routine_name,
          routine_type,
          data_type as return_type
        FROM information_schema.routines 
        WHERE routine_name = 'search_warehouses_by_location'
        AND routine_schema = 'public';
      `);
      if (result3.rows.length > 0) {
        console.log('✅ search_warehouses_by_location function exists');
        console.log('   Type:', result3.rows[0].routine_type);
        console.log('   Returns:', result3.rows[0].return_type);
        results.tests.push({
          name: 'Geographic Search Function',
          status: 'PASS',
          details: {
            function_name: result3.rows[0].routine_name,
            type: result3.rows[0].routine_type,
            return_type: result3.rows[0].return_type
          }
        });
      } else {
        console.log('❌ search_warehouses_by_location function does NOT exist');
        results.tests.push({
          name: 'Geographic Search Function',
          status: 'FAIL',
          error: 'Function not found',
          fix: 'Run migration 107 to create the function'
        });
      }
    } catch (error) {
      console.log('❌ Error checking function:', error.message);
      results.tests.push({
        name: 'Geographic Search Function',
        status: 'ERROR',
        error: error.message
      });
    }
    console.log('');

    // Test 4: Check location population
    console.log('4. Checking location column population...');
    try {
      const result4 = await client.query(`
        SELECT 
          COUNT(*) as total, 
          COUNT(location) as with_location,
          COUNT(*) - COUNT(location) as without_location
        FROM warehouses 
        WHERE status = true;
      `);
      if (result4.rows.length > 0) {
        const row = result4.rows[0];
        console.log('✅ Location data check:');
        console.log('   Total warehouses:', row.total);
        console.log('   With location:', row.with_location);
        console.log('   Without location:', row.without_location);
        
        const populationRate = row.total > 0 ? (row.with_location / row.total * 100).toFixed(2) : 0;
        const status = row.without_location == 0 ? 'PASS' : 'WARNING';
        
        results.tests.push({
          name: 'Location Data Population',
          status: status,
          details: {
            total: parseInt(row.total),
            with_location: parseInt(row.with_location),
            without_location: parseInt(row.without_location),
            population_rate: `${populationRate}%`
          },
          ...(row.without_location > 0 && {
            fix: 'Run UPDATE to populate location from lat/lng columns'
          })
        });
        
        if (row.without_location > 0) {
          console.log('   ⚠️  Some warehouses are missing location data');
        }
      }
    } catch (error) {
      console.log('❌ Error checking location population:', error.message);
      results.tests.push({
        name: 'Location Data Population',
        status: 'ERROR',
        error: error.message
      });
    }
    console.log('');

    // Test 5: Test search function
    console.log('5. Testing geographic search function...');
    try {
      // Istanbul coordinates: 41.0082, 28.9784
      const result5 = await client.query(`
        SELECT * FROM search_warehouses_by_location(41.0082, 28.9784, 100) LIMIT 5;
      `);
      console.log('✅ Search function works!');
      console.log('   Found', result5.rows.length, 'warehouses within 100km of Istanbul');
      
      const sampleResults = result5.rows.slice(0, 3).map(row => ({
        id: row.id,
        name: row.name || 'N/A',
        distance_km: row.distance_km ? parseFloat(row.distance_km).toFixed(2) : 'N/A',
        city: row.city || 'N/A'
      }));
      
      if (result5.rows.length > 0) {
        console.log('   Sample results:');
        sampleResults.forEach((row, i) => {
          console.log(`   ${i + 1}. ${row.name} (${row.city}) - Distance: ${row.distance_km} km`);
        });
      }
      
      results.tests.push({
        name: 'Geographic Search Function Test',
        status: 'PASS',
        details: {
          test_coordinates: { lat: 41.0082, lng: 28.9784, radius_km: 100 },
          results_found: result5.rows.length,
          sample_results: sampleResults
        }
      });
    } catch (error) {
      console.log('❌ Search function test failed');
      console.log('   Error:', error.message);
      let fix = '';
      if (error.message.includes('does not exist')) {
        fix = 'Run migration 107 to create the function';
      } else if (error.message.includes('location')) {
        fix = 'Ensure warehouses have location data populated';
      }
      
      results.tests.push({
        name: 'Geographic Search Function Test',
        status: 'FAIL',
        error: error.message,
        fix: fix || 'Check function definition and data availability'
      });
    }
    console.log('');

    // Test 6: Check spatial index
    console.log('6. Checking spatial index...');
    try {
      const result6 = await client.query(`
        SELECT 
          indexname, 
          indexdef 
        FROM pg_indexes 
        WHERE tablename = 'warehouses' 
        AND indexname = 'idx_warehouses_location_gist';
      `);
      if (result6.rows.length > 0) {
        console.log('✅ Spatial index exists');
        console.log('   Index:', result6.rows[0].indexname);
        results.tests.push({
          name: 'Spatial Index',
          status: 'PASS',
          details: {
            index_name: result6.rows[0].indexname,
            index_type: 'GIST'
          }
        });
      } else {
        console.log('⚠️  Spatial index does NOT exist');
        results.tests.push({
          name: 'Spatial Index',
          status: 'WARNING',
          fix: 'Run: CREATE INDEX idx_warehouses_location_gist ON warehouses USING GIST (location);'
        });
      }
    } catch (error) {
      console.log('❌ Error checking index:', error.message);
      results.tests.push({
        name: 'Spatial Index',
        status: 'ERROR',
        error: error.message
      });
    }

    // Test 7: Check trigger for auto-updating location
    console.log('7. Checking location update trigger...');
    try {
      const result7 = await client.query(`
        SELECT 
          trigger_name,
          event_manipulation,
          action_timing
        FROM information_schema.triggers
        WHERE trigger_name = 'trigger_update_warehouse_location'
        AND event_object_table = 'warehouses';
      `);
      if (result7.rows.length > 0) {
        console.log('✅ Location update trigger exists');
        results.tests.push({
          name: 'Location Update Trigger',
          status: 'PASS',
          details: {
            trigger_name: result7.rows[0].trigger_name,
            event: result7.rows[0].event_manipulation,
            timing: result7.rows[0].action_timing
          }
        });
      } else {
        console.log('⚠️  Location update trigger does NOT exist');
        results.tests.push({
          name: 'Location Update Trigger',
          status: 'WARNING',
          fix: 'Trigger should auto-update location when lat/lng changes'
        });
      }
    } catch (error) {
      console.log('❌ Error checking trigger:', error.message);
      results.tests.push({
        name: 'Location Update Trigger',
        status: 'ERROR',
        error: error.message
      });
    }

    await client.end();
    console.log('\n✅ All tests completed!');
    
    // Calculate summary
    const summary = {
      total: results.tests.length,
      passed: results.tests.filter(t => t.status === 'PASS').length,
      failed: results.tests.filter(t => t.status === 'FAIL').length,
      warnings: results.tests.filter(t => t.status === 'WARNING').length,
      errors: results.tests.filter(t => t.status === 'ERROR').length
    };
    results.summary = summary;
    
    return results;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    results.connection = 'failed';
    results.error = error.message;
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    throw error;
  }
}

// Run tests and save results
testPostGIS()
  .then(results => {
    // Generate markdown report
    const md = `# PostGIS Geographic Search - Test Report

**Test Date:** ${new Date(results.timestamp).toLocaleString()}
**Database:** Connected ${results.connection === 'success' ? '✅' : '❌'}

## Test Summary

- **Total Tests:** ${results.summary.total}
- **Passed:** ${results.summary.passed} ✅
- **Failed:** ${results.summary.failed} ❌
- **Warnings:** ${results.summary.warnings} ⚠️
- **Errors:** ${results.summary.errors} 🔴

**Overall Status:** ${results.summary.failed === 0 && results.summary.errors === 0 ? '✅ PASS' : '❌ FAIL'}

---

## Test Results

${results.tests.map((test, i) => {
  const statusIcon = {
    'PASS': '✅',
    'FAIL': '❌',
    'WARNING': '⚠️',
    'ERROR': '🔴'
  }[test.status] || '❓';
  
  let details = '';
  if (test.details) {
    details = '\n\n**Details:**\n' + Object.entries(test.details).map(([key, value]) => {
      if (typeof value === 'object' && !Array.isArray(value)) {
        return `- ${key}: ${JSON.stringify(value, null, 2).replace(/\n/g, '\n  ')}`;
      }
      return `- ${key}: ${value}`;
    }).join('\n');
  }
  
  let error = '';
  if (test.error) {
    error = `\n\n**Error:** ${test.error}`;
  }
  
  let fix = '';
  if (test.fix) {
    fix = `\n\n**Fix:** ${test.fix}`;
  }
  
  return `### ${i + 1}. ${test.name} ${statusIcon} ${test.status}

${details}${error}${fix}`;
}).join('\n\n---\n\n')}

---

## Recommendations

${results.summary.failed > 0 || results.summary.errors > 0 ? `
⚠️ **Action Required:** Some tests failed. Please review the errors above and apply the suggested fixes.
` : results.summary.warnings > 0 ? `
⚠️ **Warnings:** Some non-critical issues were detected. Consider addressing them for optimal performance.
` : `
✅ **All Critical Tests Passed:** PostGIS geographic search functionality is working correctly.
`}

---

*Report generated automatically by test-postgis.js*
`;

    // Ensure tests directory exists
    const testsDir = path.join(root, 'tests');
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }

    // Save report
    const reportPath = path.join(testsDir, `postgis-test-${new Date().toISOString().split('T')[0]}.md`);
    fs.writeFileSync(reportPath, md, 'utf8');
    console.log(`\n📄 Test report saved to: ${reportPath}`);
    
    process.exit(results.summary.failed > 0 || results.summary.errors > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Failed to generate report:', error);
    process.exit(1);
  });

