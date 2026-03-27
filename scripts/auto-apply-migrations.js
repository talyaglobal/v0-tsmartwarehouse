/**
 * AUTO-APPLY SQL MIGRATIONS via Kolaybase SQL Execution API
 *
 * Uses: POST /api/sql/execute
 * Requires: Platform JWT or project API key
 */

const fs = require("fs");
const path = require("path");

const API_BASE = "https://api.kolaybase.com";
const SERVICE_KEY =
  process.env.KOLAYBASE_SERVICE_KEY || "kb_service_zhg_E3u8s3m605gv_OzQwohjQJEK7Kn9y5I4wNhp6cw";
const PROJECT_ID = process.env.KOLAYBASE_PROJECT_ID || "kb-warebnb"; // Extracted from realm name

async function executeSqlMigration(sql, migrationName) {
  console.log(`\n📄 Executing: ${migrationName}`);
  console.log(`   SQL size: ${sql.length} bytes`);

  try {
    const response = await fetch(`${API_BASE}/api/sql/execute`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: PROJECT_ID,
        query: sql,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`   ❌ Failed: ${response.status} ${response.statusText}`);
      console.error(`   Error: ${errorText}`);
      return false;
    }

    const result = await response.json();
    console.log(`   ✅ Success!`);
    console.log(`   Rows affected: ${result.rowCount || 0}`);
    console.log(`   Duration: ${result.duration || 0}ms`);
    return true;
  } catch (error) {
    console.error(`   ❌ Execution error:`, error.message);
    return false;
  }
}

async function main() {
  console.log("🚀 AUTO-APPLYING CRITICAL MIGRATIONS\n");
  console.log(`📡 Kolaybase API: ${API_BASE}`);
  console.log(`📊 Project ID: ${PROJECT_ID}`);
  console.log(`🔑 Using service key: ${SERVICE_KEY.substring(0, 20)}...\n`);

  const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");

  const migrations = [
    "20260327130000_booking_cancellation_refund.sql",
    "20260327140000_concurrency_protection.sql",
  ];

  let successCount = 0;
  let failCount = 0;

  for (const migrationFile of migrations) {
    const filePath = path.join(migrationsDir, migrationFile);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ Migration not found: ${migrationFile}`);
      failCount++;
      continue;
    }

    const sql = fs.readFileSync(filePath, "utf8");
    const success = await executeSqlMigration(sql, migrationFile);

    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log(`\n📊 MIGRATION SUMMARY`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);

  if (failCount === 0) {
    console.log("\n🎉 All migrations applied successfully!");

    // Verify functions were created
    console.log("\n🔍 Verifying database functions...");
    const verifyResult = await executeSqlMigration(
      `
      SELECT proname, prokind 
      FROM pg_proc 
      WHERE proname IN (
        'log_payment_event',
        'is_webhook_event_processed',
        'can_checkout_pallets',
        'lock_pallets_for_checkout',
        'release_pallet_locks',
        'cleanup_stale_pallet_locks'
      ) 
      AND pronamespace = 'public'::regnamespace;
      `,
      "Function verification"
    );

    if (verifyResult) {
      console.log("✅ Database ready for production!");
    }
  } else {
    console.log("\n⚠️  Some migrations failed. Check errors above.");
  }
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
