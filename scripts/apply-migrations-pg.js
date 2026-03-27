/**
 * Apply Critical Migrations via Node.js pg client
 *
 * Uses direct PostgreSQL connection to execute DDL statements
 */

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const DATABASE_URL =
  "postgresql://kb_user_warebnb:0Oug-vAw5PJIFUewk0wmyt6V4Djv7NPb@db.kolaybase.com:6432/kb_warebnb";

async function main() {
  console.log("🚀 Applying Critical Migrations to Kolaybase\n");

  const client = new Client({
    connectionString: DATABASE_URL,
    // Try without SSL first for Kolaybase
  });

  try {
    console.log("📡 Connecting to database...");
    await client.connect();
    console.log("✅ Connected successfully\n");

    const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");

    const migrations = [
      "20260327130000_booking_cancellation_refund.sql",
      "20260327140000_concurrency_protection.sql",
    ];

    for (const migrationFile of migrations) {
      const filePath = path.join(migrationsDir, migrationFile);

      if (!fs.existsSync(filePath)) {
        console.error(`❌ Migration not found: ${migrationFile}`);
        continue;
      }

      console.log(`📄 Applying: ${migrationFile}`);
      const sql = fs.readFileSync(filePath, "utf8");

      try {
        await client.query(sql);
        console.log(`✅ Migration applied successfully\n`);
      } catch (error) {
        console.error(`❌ Migration failed:`, error.message);
        console.error(`   Hint:`, error.hint || "No additional info");
        console.error("");
      }
    }

    // Verify critical functions were created
    console.log("🔍 Verifying functions created...\n");

    const functions = [
      "log_payment_event",
      "is_webhook_event_processed",
      "can_checkout_pallets",
      "lock_pallets_for_checkout",
      "release_pallet_locks",
      "cleanup_stale_pallet_locks",
    ];

    for (const funcName of functions) {
      const result = await client.query(
        `
        SELECT proname, prokind 
        FROM pg_proc 
        WHERE proname = $1 AND pronamespace = 'public'::regnamespace
      `,
        [funcName]
      );

      if (result.rows.length > 0) {
        console.log(`✅ Function exists: public.${funcName}()`);
      } else {
        console.log(`❌ Function missing: public.${funcName}()`);
      }
    }

    console.log("\n✅ Migration verification complete!");
  } catch (error) {
    console.error("\n❌ Database connection error:", error.message);
    console.error("\nPlease check:");
    console.error("1. Database is accessible from your network");
    console.error("2. Credentials are correct");
    console.error("3. SSL certificate is valid");
  } finally {
    await client.end();
  }
}

main().catch(console.error);
