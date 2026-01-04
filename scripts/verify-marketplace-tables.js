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

const results = {
  timestamp: new Date().toISOString(),
  tests: []
};

async function verifyMarketplaceTables() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Test 1: Check if all marketplace tables exist
    console.log('1. Checking if all marketplace tables exist...');
    try {
      const expectedTables = [
        'reviews',
        'warehouse_review_summary',
        'conversations',
        'messages',
        'favorites',
        'inquiries',
        'warehouse_availability',
        'platform_settings',
        'host_payouts'
      ];

      const result1 = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (${expectedTables.map((_, i) => `$${i + 1}`).join(', ')})
        ORDER BY table_name;
      `, expectedTables);

      const foundTables = result1.rows.map(r => r.table_name);
      const missingTables = expectedTables.filter(t => !foundTables.includes(t));

      console.log(`Found ${foundTables.length} of ${expectedTables.length} tables:`);
      foundTables.forEach(t => console.log(`  ✅ ${t}`));
      
      if (missingTables.length > 0) {
        console.log(`\nMissing tables (${missingTables.length}):`);
        missingTables.forEach(t => console.log(`  ❌ ${t}`));
      }

      results.tests.push({
        name: 'Marketplace Tables Existence',
        status: missingTables.length === 0 ? 'PASS' : 'FAIL',
        expected: expectedTables.length,
        found: foundTables.length,
        tables: foundTables,
        missing: missingTables
      });
    } catch (error) {
      console.log('❌ Error:', error.message);
      results.tests.push({
        name: 'Marketplace Tables Existence',
        status: 'ERROR',
        error: error.message
      });
    }
    console.log('');

    // Test 2: Check reviews table structure
    console.log('2. Checking reviews table structure...');
    try {
      // First check if it's warehouse_reviews or reviews
      const checkTable = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('reviews', 'warehouse_reviews')
        ORDER BY table_name;
      `);

      const reviewsTableName = checkTable.rows.length > 0 ? checkTable.rows[0].table_name : null;

      if (reviewsTableName) {
        const result2 = await client.query(`
          SELECT 
            column_name, 
            data_type, 
            is_nullable,
            column_default
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position;
        `, [reviewsTableName]);

        console.log(`✅ ${reviewsTableName} table structure:`);
        result2.rows.forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'} ${col.column_default ? `[default: ${col.column_default}]` : ''}`);
        });

        results.tests.push({
          name: 'Reviews Table Structure',
          status: 'PASS',
          table_name: reviewsTableName,
          columns: result2.rows.map(r => ({
            name: r.column_name,
            type: r.data_type,
            nullable: r.is_nullable === 'YES',
            default: r.column_default
          }))
        });
      } else {
        console.log('❌ Neither reviews nor warehouse_reviews table found');
        results.tests.push({
          name: 'Reviews Table Structure',
          status: 'FAIL',
          error: 'Table not found'
        });
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
      results.tests.push({
        name: 'Reviews Table Structure',
        status: 'ERROR',
        error: error.message
      });
    }
    console.log('');

    // Test 3: Check platform_settings default values
    console.log('3. Checking platform_settings default values...');
    try {
      const result3 = await client.query(`
        SELECT key, value, description 
        FROM platform_settings
        ORDER BY key;
      `);

      if (result3.rows.length > 0) {
        console.log(`✅ Found ${result3.rows.length} platform settings:`);
        result3.rows.forEach(row => {
          console.log(`  - ${row.key}: ${row.value || 'NULL'} ${row.description ? `(${row.description})` : ''}`);
        });

        results.tests.push({
          name: 'Platform Settings',
          status: 'PASS',
          count: result3.rows.length,
          settings: result3.rows.map(r => ({
            key: r.key,
            value: r.value,
            description: r.description
          }))
        });
      } else {
        console.log('⚠️  No platform settings found (table may be empty)');
        results.tests.push({
          name: 'Platform Settings',
          status: 'WARNING',
          count: 0,
          message: 'Table exists but has no default values'
        });
      }
    } catch (error) {
      if (error.message.includes('does not exist')) {
        console.log('❌ platform_settings table does not exist');
        results.tests.push({
          name: 'Platform Settings',
          status: 'FAIL',
          error: 'Table not found'
        });
      } else {
        console.log('❌ Error:', error.message);
        results.tests.push({
          name: 'Platform Settings',
          status: 'ERROR',
          error: error.message
        });
      }
    }
    console.log('');

    // Test 4: Check companies table Stripe Connect columns
    console.log('4. Checking companies table Stripe Connect columns...');
    try {
      const result4 = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'companies' 
        AND (column_name LIKE 'stripe%' OR column_name LIKE 'verification%')
        ORDER BY column_name;
      `);

      if (result4.rows.length > 0) {
        console.log(`✅ Found ${result4.rows.length} Stripe/Verification columns:`);
        result4.rows.forEach(row => {
          console.log(`  - ${row.column_name}`);
        });

        results.tests.push({
          name: 'Companies Stripe Connect Columns',
          status: 'PASS',
          count: result4.rows.length,
          columns: result4.rows.map(r => r.column_name)
        });
      } else {
        console.log('⚠️  No Stripe/Verification columns found in companies table');
        results.tests.push({
          name: 'Companies Stripe Connect Columns',
          status: 'WARNING',
          count: 0,
          message: 'Columns not found'
        });
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
      results.tests.push({
        name: 'Companies Stripe Connect Columns',
        status: 'ERROR',
        error: error.message
      });
    }
    console.log('');

    // Test 5: Check warehouse_listings view
    console.log('5. Checking warehouse_listings view...');
    try {
      const result5 = await client.query(`
        SELECT viewname 
        FROM pg_views 
        WHERE schemaname = 'public' 
        AND viewname = 'warehouse_listings';
      `);

      if (result5.rows.length > 0) {
        console.log('✅ warehouse_listings view exists');
        
        // Get view definition
        const viewDef = await client.query(`
          SELECT definition 
          FROM pg_views 
          WHERE schemaname = 'public' 
          AND viewname = 'warehouse_listings';
        `);

        results.tests.push({
          name: 'Warehouse Listings View',
          status: 'PASS',
          exists: true,
          definition_length: viewDef.rows[0]?.definition?.length || 0
        });
      } else {
        console.log('❌ warehouse_listings view does not exist');
        results.tests.push({
          name: 'Warehouse Listings View',
          status: 'FAIL',
          exists: false
        });
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
      results.tests.push({
        name: 'Warehouse Listings View',
        status: 'ERROR',
        error: error.message
      });
    }
    console.log('');

    // Test 6: Count records in each marketplace table
    console.log('6. Counting records in marketplace tables...');
    try {
      const tables = [
        { name: 'reviews', alt: 'warehouse_reviews' },
        { name: 'conversations' },
        { name: 'messages', alt: 'warehouse_messages' },
        { name: 'favorites', alt: 'warehouse_favorites' },
        { name: 'inquiries' },
        { name: 'warehouse_availability' },
        { name: 'host_payouts' }
      ];

      const counts = [];
      
      for (const table of tables) {
        try {
          // Try primary name first
          let result = await client.query(`SELECT COUNT(*) as count FROM ${table.name};`);
          counts.push({
            table_name: table.name,
            count: parseInt(result.rows[0].count),
            status: 'found'
          });
        } catch (error) {
          // Try alternative name if exists
          if (table.alt) {
            try {
              let result = await client.query(`SELECT COUNT(*) as count FROM ${table.alt};`);
              counts.push({
                table_name: table.alt,
                count: parseInt(result.rows[0].count),
                status: 'found (alternative)'
              });
            } catch (e) {
              counts.push({
                table_name: table.name,
                count: 0,
                status: 'not found',
                error: e.message
              });
            }
          } else {
            counts.push({
              table_name: table.name,
              count: 0,
              status: 'not found',
              error: error.message
            });
          }
        }
      }

      console.log('Record counts:');
      counts.forEach(c => {
        const icon = c.status === 'found' || c.status === 'found (alternative)' ? '✅' : '❌';
        console.log(`  ${icon} ${c.table_name}: ${c.count} record(s) ${c.status === 'found (alternative)' ? `(using ${c.table_name})` : ''}`);
      });

      results.tests.push({
        name: 'Table Record Counts',
        status: 'PASS',
        counts: counts
      });
    } catch (error) {
      console.log('❌ Error:', error.message);
      results.tests.push({
        name: 'Table Record Counts',
        status: 'ERROR',
        error: error.message
      });
    }
    console.log('');

    // Additional: Check indexes on key tables
    console.log('7. Checking indexes on marketplace tables...');
    try {
      const result7 = await client.query(`
        SELECT 
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename IN ('warehouse_reviews', 'reviews', 'conversations', 'messages', 'warehouse_messages', 'favorites', 'warehouse_favorites', 'inquiries', 'warehouse_availability')
        ORDER BY tablename, indexname;
      `);

      if (result7.rows.length > 0) {
        console.log(`✅ Found ${result7.rows.length} indexes:`);
        const byTable = {};
        result7.rows.forEach(row => {
          if (!byTable[row.tablename]) byTable[row.tablename] = [];
          byTable[row.tablename].push(row.indexname);
        });
        
        Object.entries(byTable).forEach(([table, indexes]) => {
          console.log(`  ${table}: ${indexes.length} index(es)`);
          indexes.forEach(idx => console.log(`    - ${idx}`));
        });

        results.tests.push({
          name: 'Table Indexes',
          status: 'PASS',
          total_indexes: result7.rows.length,
          indexes_by_table: byTable
        });
      } else {
        console.log('⚠️  No indexes found on marketplace tables');
        results.tests.push({
          name: 'Table Indexes',
          status: 'WARNING',
          total_indexes: 0
        });
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
      results.tests.push({
        name: 'Table Indexes',
        status: 'ERROR',
        error: error.message
      });
    }

    await client.end();
    console.log('\n✅ All verifications completed!');
    
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
    console.error('❌ Verification failed:', error.message);
    results.error = error.message;
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
    throw error;
  }
}

// Run verification and save results
verifyMarketplaceTables()
  .then(results => {
    // Generate markdown report
    const md = `# Marketplace Tables Verification Report

**Date:** ${new Date(results.timestamp).toLocaleString()}
**Status:** ${results.error ? '❌ Failed' : '✅ Completed'}

${results.error ? `\n## Error\n\n${results.error}\n` : ''}

## Verification Summary

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
  
  let content = `### ${i + 1}. ${test.name} ${statusIcon} ${test.status}\n\n`;
  
  if (test.error) {
    content += `**Error:** ${test.error}\n`;
  } else {
    if (test.expected !== undefined) {
      content += `- **Expected:** ${test.expected} tables\n`;
      content += `- **Found:** ${test.found} tables\n`;
    }
    
    if (test.tables) {
      content += `\n**Tables Found:**\n`;
      test.tables.forEach(t => content += `- ✅ ${t}\n`);
    }
    
    if (test.missing && test.missing.length > 0) {
      content += `\n**Missing Tables:**\n`;
      test.missing.forEach(t => content += `- ❌ ${t}\n`);
    }
    
    if (test.table_name) {
      content += `\n**Table:** ${test.table_name}\n`;
    }
    
    if (test.columns) {
      content += `\n**Columns (${test.columns.length}):**\n`;
      test.columns.forEach(col => {
        content += `- \`${col.name}\`: ${col.type} ${col.nullable ? '(nullable)' : '(not null)'}`;
        if (col.default) {
          content += ` [default: ${col.default}]`;
        }
        content += `\n`;
      });
    }
    
    if (test.count !== undefined) {
      content += `- **Count:** ${test.count}\n`;
    }
    
    if (test.settings) {
      content += `\n**Settings:**\n`;
      test.settings.forEach(s => {
        content += `- **${s.key}:** ${s.value || 'NULL'}`;
        if (s.description) {
          content += ` - ${s.description}`;
        }
        content += `\n`;
      });
    }
    
    if (test.columns && Array.isArray(test.columns) && test.columns.length > 0 && typeof test.columns[0] === 'string') {
      content += `\n**Columns:**\n`;
      test.columns.forEach(col => content += `- ${col}\n`);
    }
    
    if (test.exists !== undefined) {
      content += `- **Exists:** ${test.exists ? 'Yes' : 'No'}\n`;
    }
    
    if (test.counts) {
      content += `\n**Record Counts:**\n`;
      test.counts.forEach(c => {
        const icon = c.status === 'found' || c.status === 'found (alternative)' ? '✅' : '❌';
        content += `- ${icon} **${c.table_name}:** ${c.count} record(s)`;
        if (c.status === 'found (alternative)') {
          content += ` (using alternative table name)`;
        }
        if (c.error) {
          content += ` - Error: ${c.error}`;
        }
        content += `\n`;
      });
    }
    
    if (test.indexes_by_table) {
      content += `\n**Indexes by Table:**\n`;
      Object.entries(test.indexes_by_table).forEach(([table, indexes]) => {
        content += `- **${table}:** ${indexes.length} index(es)\n`;
        indexes.forEach(idx => content += `  - ${idx}\n`);
      });
    }
    
    if (test.message) {
      content += `\n**Note:** ${test.message}\n`;
    }
  }
  
  return content;
}).join('\n---\n\n')}

---

## Recommendations

${results.summary.failed > 0 || results.summary.errors > 0 ? `
⚠️ **Action Required:** Some verifications failed. Please review the errors above and ensure migration 107 was applied correctly.
` : results.summary.warnings > 0 ? `
⚠️ **Warnings:** Some non-critical issues were detected. Review the warnings above.
` : `
✅ **All Critical Verifications Passed:** All marketplace tables from migration 107 are properly created and structured.
`}

---

*Report generated automatically by verify-marketplace-tables.js*
`;

    // Ensure tests directory exists
    const testsDir = path.join(root, 'tests');
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }

    // Save report
    const reportPath = path.join(testsDir, `marketplace-tables-verification-${new Date().toISOString().split('T')[0]}.md`);
    fs.writeFileSync(reportPath, md, 'utf8');
    console.log(`\n📄 Verification report saved to: ${reportPath}`);
    
    process.exit(results.summary.failed > 0 || results.summary.errors > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Failed to generate report:', error);
    process.exit(1);
  });

