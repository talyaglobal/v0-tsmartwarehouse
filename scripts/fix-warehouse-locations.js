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
  steps: []
};

async function fixWarehouseLocations() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Step 1: Find warehouse without location
    console.log('Step 1: Finding warehouses without location data...');
    try {
      const result1 = await client.query(`
        SELECT id, name, city, latitude, longitude, location 
        FROM warehouses 
        WHERE location IS NULL AND status = true;
      `);
      
      console.log(`Found ${result1.rows.length} warehouse(s) without location:`);
      result1.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.name || row.id}`);
        console.log(`     City: ${row.city || 'N/A'}`);
        console.log(`     Lat: ${row.latitude || 'NULL'}, Lng: ${row.longitude || 'NULL'}`);
      });
      
      results.steps.push({
        step: 1,
        name: 'Find warehouses without location',
        count: result1.rows.length,
        warehouses: result1.rows.map(r => ({
          id: r.id,
          name: r.name,
          city: r.city,
          latitude: r.latitude,
          longitude: r.longitude
        }))
      });
    } catch (error) {
      console.log('❌ Error:', error.message);
      results.steps.push({
        step: 1,
        name: 'Find warehouses without location',
        error: error.message
      });
    }
    console.log('');

    // Step 2: Populate location from lat/lng
    console.log('Step 2: Populating location from lat/lng...');
    try {
      const result2 = await client.query(`
        UPDATE warehouses 
        SET location = ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography 
        WHERE location IS NULL 
          AND latitude IS NOT NULL 
          AND longitude IS NOT NULL
          AND latitude::text != ''
          AND longitude::text != '';
      `);
      
      console.log(`✅ Updated ${result2.rowCount} warehouse(s)`);
      results.steps.push({
        step: 2,
        name: 'Populate location from lat/lng',
        updated: result2.rowCount
      });
    } catch (error) {
      console.log('❌ Error:', error.message);
      results.steps.push({
        step: 2,
        name: 'Populate location from lat/lng',
        error: error.message
      });
    }
    console.log('');

    // Step 3: Show all warehouses with coordinates
    console.log('Step 3: Listing all warehouses with coordinates...');
    try {
      const result3 = await client.query(`
        SELECT 
          id, 
          name, 
          city, 
          latitude, 
          longitude, 
          CASE 
            WHEN location IS NOT NULL THEN ST_AsText(location::geometry)
            ELSE 'NULL'
          END as location_text
        FROM warehouses 
        WHERE status = true 
        ORDER BY city, name;
      `);
      
      console.log(`Total warehouses: ${result3.rows.length}`);
      console.log('\nWarehouses by city:');
      
      const byCity = {};
      result3.rows.forEach(row => {
        const city = row.city || 'Unknown';
        if (!byCity[city]) byCity[city] = [];
        byCity[city].push(row);
      });
      
      Object.entries(byCity).forEach(([city, warehouses]) => {
        console.log(`\n  ${city} (${warehouses.length}):`);
        warehouses.forEach(w => {
          const hasLocation = w.location_text !== 'NULL';
          console.log(`    - ${w.name || w.id}`);
          console.log(`      Coordinates: ${w.latitude || 'N/A'}, ${w.longitude || 'N/A'}`);
          console.log(`      Location: ${hasLocation ? '✅' : '❌'} ${hasLocation ? w.location_text : 'Missing'}`);
        });
      });
      
      results.steps.push({
        step: 3,
        name: 'List all warehouses',
        total: result3.rows.length,
        by_city: byCity,
        warehouses: result3.rows.map(r => ({
          id: r.id,
          name: r.name,
          city: r.city,
          latitude: r.latitude,
          longitude: r.longitude,
          has_location: r.location_text !== 'NULL'
        }))
      });
    } catch (error) {
      console.log('❌ Error:', error.message);
      results.steps.push({
        step: 3,
        name: 'List all warehouses',
        error: error.message
      });
    }
    console.log('');

    // Step 4: Find geographic center
    console.log('Step 4: Calculating geographic center of all warehouses...');
    try {
      const result4 = await client.query(`
        SELECT 
          AVG(latitude::double precision) as center_lat, 
          AVG(longitude::double precision) as center_lng,
          COUNT(*) as warehouse_count
        FROM warehouses 
        WHERE latitude IS NOT NULL 
          AND longitude IS NOT NULL
          AND latitude::text != ''
          AND longitude::text != '';
      `);
      
      if (result4.rows.length > 0 && result4.rows[0].center_lat) {
        const center = {
          lat: parseFloat(result4.rows[0].center_lat),
          lng: parseFloat(result4.rows[0].center_lng),
          count: parseInt(result4.rows[0].warehouse_count)
        };
        
        console.log(`✅ Geographic center calculated from ${center.count} warehouses:`);
        console.log(`   Latitude: ${center.lat.toFixed(6)}`);
        console.log(`   Longitude: ${center.lng.toFixed(6)}`);
        
        results.steps.push({
          step: 4,
          name: 'Geographic center',
          center: center
        });
        
        // Step 5: Test search with center coordinates
        console.log('\nStep 5: Testing search function with center coordinates...');
        try {
          const radius = 500; // 500km radius
          const result5 = await client.query(`
            SELECT 
              name, 
              city, 
              distance_km,
              latitude,
              longitude
            FROM search_warehouses_by_location($1, $2, $3) 
            ORDER BY distance_km
            LIMIT 10;
          `, [center.lat, center.lng, radius]);
          
          console.log(`✅ Found ${result5.rows.length} warehouse(s) within ${radius}km of center:`);
          if (result5.rows.length > 0) {
            result5.rows.forEach((row, i) => {
              console.log(`  ${i + 1}. ${row.name || 'N/A'} (${row.city || 'N/A'})`);
              console.log(`     Distance: ${parseFloat(row.distance_km).toFixed(2)} km`);
              console.log(`     Coordinates: ${row.latitude}, ${row.longitude}`);
            });
          } else {
            console.log('  ⚠️  No warehouses found. This might indicate:');
            console.log('     - Warehouses are outside the search radius');
            console.log('     - Location data is not properly populated');
            console.log('     - Search function needs adjustment');
          }
          
          results.steps.push({
            step: 5,
            name: 'Test search with center',
            center: { lat: center.lat, lng: center.lng, radius_km: radius },
            results_found: result5.rows.length,
            results: result5.rows.map(r => ({
              name: r.name,
              city: r.city,
              distance_km: parseFloat(r.distance_km).toFixed(2),
              latitude: r.latitude,
              longitude: r.longitude
            }))
          });
        } catch (error) {
          console.log('❌ Error testing search:', error.message);
          results.steps.push({
            step: 5,
            name: 'Test search with center',
            error: error.message
          });
        }
      } else {
        console.log('⚠️  Could not calculate center - no valid coordinates found');
        results.steps.push({
          step: 4,
          name: 'Geographic center',
          warning: 'No valid coordinates found'
        });
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
      results.steps.push({
        step: 4,
        name: 'Geographic center',
        error: error.message
      });
    }

    // Final verification
    console.log('\n=== Final Verification ===');
    try {
      const verify = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(location) as with_location,
          COUNT(*) - COUNT(location) as without_location
        FROM warehouses 
        WHERE status = true;
      `);
      
      if (verify.rows.length > 0) {
        const v = verify.rows[0];
        const rate = v.total > 0 ? ((v.with_location / v.total) * 100).toFixed(2) : 0;
        console.log(`Total warehouses: ${v.total}`);
        console.log(`With location: ${v.with_location} (${rate}%)`);
        console.log(`Without location: ${v.without_location}`);
        
        results.verification = {
          total: parseInt(v.total),
          with_location: parseInt(v.with_location),
          without_location: parseInt(v.without_location),
          population_rate: `${rate}%`
        };
      }
    } catch (error) {
      console.log('❌ Verification error:', error.message);
    }

    await client.end();
    console.log('\n✅ All operations completed!');
    
    return results;
  } catch (error) {
    console.error('❌ Operation failed:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    results.error = error.message;
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    throw error;
  }
}

// Run fix and save results
fixWarehouseLocations()
  .then(results => {
    // Generate markdown report
    const md = `# Warehouse Location Data Fix & Verification Report

**Date:** ${new Date(results.timestamp).toLocaleString()}
**Status:** ${results.error ? '❌ Failed' : '✅ Completed'}

${results.error ? `\n## Error\n\n${results.error}\n` : ''}

## Operations Summary

${results.steps.map(step => {
  let content = `### Step ${step.step}: ${step.name}\n\n`;
  
  if (step.error) {
    content += `❌ **Error:** ${step.error}\n`;
  } else if (step.warning) {
    content += `⚠️ **Warning:** ${step.warning}\n`;
  } else {
    content += `✅ **Status:** Success\n\n`;
    
    if (step.count !== undefined) {
      content += `- **Count:** ${step.count}\n`;
    }
    if (step.updated !== undefined) {
      content += `- **Updated:** ${step.updated} warehouse(s)\n`;
    }
    if (step.total !== undefined) {
      content += `- **Total:** ${step.total} warehouse(s)\n`;
    }
    if (step.center) {
      content += `- **Center Coordinates:**\n`;
      content += `  - Latitude: ${step.center.lat.toFixed(6)}\n`;
      content += `  - Longitude: ${step.center.lng.toFixed(6)}\n`;
      if (step.center.count) {
        content += `  - Based on: ${step.center.count} warehouses\n`;
      }
    }
    if (step.results_found !== undefined) {
      content += `- **Search Results:** ${step.results_found} warehouse(s) found\n`;
    }
    
    if (step.warehouses && step.warehouses.length > 0) {
      content += `\n**Warehouses:**\n`;
      step.warehouses.forEach(w => {
        content += `- ${w.name || w.id} (${w.city || 'N/A'})\n`;
        if (w.latitude && w.longitude) {
          content += `  - Coordinates: ${w.latitude}, ${w.longitude}\n`;
        }
        if (w.has_location !== undefined) {
          content += `  - Location: ${w.has_location ? '✅' : '❌'}\n`;
        }
      });
    }
    
    if (step.by_city) {
      content += `\n**By City:**\n`;
      Object.entries(step.by_city).forEach(([city, warehouses]) => {
        content += `- **${city}:** ${warehouses.length} warehouse(s)\n`;
      });
    }
    
    if (step.results && step.results.length > 0) {
      content += `\n**Search Results:**\n`;
      step.results.forEach((r, i) => {
        content += `${i + 1}. ${r.name || 'N/A'} (${r.city || 'N/A'})\n`;
        content += `   - Distance: ${r.distance_km} km\n`;
        content += `   - Coordinates: ${r.latitude}, ${r.longitude}\n`;
      });
    }
  }
  
  return content;
}).join('\n---\n\n')}

${results.verification ? `
## Final Verification

- **Total Warehouses:** ${results.verification.total}
- **With Location:** ${results.verification.with_location} (${results.verification.population_rate})
- **Without Location:** ${results.verification.without_location}

${results.verification.without_location > 0 ? `
⚠️ **Warning:** ${results.verification.without_location} warehouse(s) still missing location data. These warehouses may not appear in geographic searches.
` : `
✅ **Success:** All warehouses have location data populated.
`}
` : ''}

---

*Report generated automatically by fix-warehouse-locations.js*
`;

    // Ensure tests directory exists
    const testsDir = path.join(root, 'tests');
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }

    // Save report
    const reportPath = path.join(testsDir, `warehouse-location-fix-${new Date().toISOString().split('T')[0]}.md`);
    fs.writeFileSync(reportPath, md, 'utf8');
    console.log(`\n📄 Report saved to: ${reportPath}`);
    
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed to complete operations:', error);
    process.exit(1);
  });

