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
  console.error('ERROR: DATABASE_URL not found.');
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

async function testSearchFunction() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Test locations with known warehouses
    const testLocations = [
      { name: 'İzmir, Turkey', lat: 38.4237, lng: 27.1428, radius: 100 },
      { name: 'New York, USA', lat: 40.7128, lng: -74.0060, radius: 50 },
      { name: 'Philadelphia, USA', lat: 39.9526, lng: -75.1652, radius: 50 },
      { name: 'Toronto, Canada', lat: 43.6532, lng: -79.3832, radius: 50 },
      { name: 'Edirne, Turkey', lat: 41.6772, lng: 26.5556, radius: 100 }
    ];

    const results = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    for (const testLoc of testLocations) {
      console.log(`Testing search from ${testLoc.name} (${testLoc.lat}, ${testLoc.lng}) within ${testLoc.radius}km...`);
      
      try {
        const result = await client.query(`
          SELECT 
            name, 
            city, 
            distance_km,
            latitude,
            longitude
          FROM search_warehouses_by_location($1, $2, $3) 
          ORDER BY distance_km
          LIMIT 10;
        `, [testLoc.lat, testLoc.lng, testLoc.radius]);

        console.log(`  Found ${result.rows.length} warehouse(s):`);
        if (result.rows.length > 0) {
          result.rows.forEach((row, i) => {
            console.log(`    ${i + 1}. ${row.name || 'N/A'} (${row.city || 'N/A'}) - ${parseFloat(row.distance_km).toFixed(2)} km`);
          });
        } else {
          console.log('    ⚠️  No warehouses found');
        }
        console.log('');

        results.tests.push({
          location: testLoc.name,
          coordinates: { lat: testLoc.lat, lng: testLoc.lng },
          radius_km: testLoc.radius,
          results_found: result.rows.length,
          warehouses: result.rows.map(r => ({
            name: r.name,
            city: r.city,
            distance_km: parseFloat(r.distance_km).toFixed(2),
            coordinates: { lat: r.latitude, lng: r.longitude }
          }))
        });
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}\n`);
        results.tests.push({
          location: testLoc.name,
          error: error.message
        });
      }
    }

    await client.end();

    // Generate report
    const md = `# Geographic Search Function Test Report

**Date:** ${new Date(results.timestamp).toLocaleString()}

## Test Results

${results.tests.map((test, i) => {
  let content = `### Test ${i + 1}: ${test.location}\n\n`;
  content += `**Coordinates:** ${test.coordinates?.lat}, ${test.coordinates?.lng}\n`;
  content += `**Radius:** ${test.radius_km}km\n\n`;
  
  if (test.error) {
    content += `❌ **Error:** ${test.error}\n`;
  } else {
    content += `✅ **Results Found:** ${test.results_found} warehouse(s)\n\n`;
    
    if (test.warehouses && test.warehouses.length > 0) {
      content += `**Warehouses:**\n`;
      test.warehouses.forEach((w, idx) => {
        content += `${idx + 1}. **${w.name || 'N/A'}** (${w.city || 'N/A'})\n`;
        content += `   - Distance: ${w.distance_km} km\n`;
        content += `   - Coordinates: ${w.coordinates.lat}, ${w.coordinates.lng}\n`;
      });
    } else {
      content += `⚠️ No warehouses found within the search radius.\n`;
    }
  }
  
  return content;
}).join('\n---\n\n')}

## Summary

- **Total Tests:** ${results.tests.length}
- **Successful Searches:** ${results.tests.filter(t => !t.error && t.results_found > 0).length}
- **Empty Results:** ${results.tests.filter(t => !t.error && t.results_found === 0).length}
- **Errors:** ${results.tests.filter(t => t.error).length}

---

*Report generated automatically by test-search-function.js*
`;

    const testsDir = path.join(root, 'tests');
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }

    const reportPath = path.join(testsDir, `search-function-test-${new Date().toISOString().split('T')[0]}.md`);
    fs.writeFileSync(reportPath, md, 'utf8');
    console.log(`📄 Report saved to: ${reportPath}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testSearchFunction();

