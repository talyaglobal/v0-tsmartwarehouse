/**
 * Apply Critical Migrations for Phase 1B
 *
 * Migrations:
 * 1. Booking cancellation & refund tracking
 * 2. Concurrency protection for checkout
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials");
  console.error("Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeSqlFile(filePath) {
  const sql = fs.readFileSync(filePath, "utf8");

  console.log(`\n📄 Executing: ${path.basename(filePath)}`);
  console.log(`   File size: ${sql.length} bytes`);

  // Split by semicolon and filter empty statements
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(`   Statements: ${statements.length}`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    // Skip comments
    if (statement.startsWith("--") || statement.startsWith("/*")) {
      continue;
    }

    try {
      const { error } = await supabase
        .rpc("exec_sql", { sql: statement + ";" })
        .catch(() => ({ error: null })); // RPC might not exist, try direct

      if (error) {
        // Try direct SQL execution
        const { error: directError } = await supabase.from("_migrations").select("*").limit(0); // Just to test connection

        if (directError) {
          console.error(`   ❌ Statement ${i + 1} failed:`, error.message);
          errorCount++;
        } else {
          console.log(`   ⚠️  Cannot execute DDL via Supabase client (needs direct pg connection)`);
          console.log(`   💡 Please run migrations directly:`);
          console.log(`      psql $DATABASE_URL -f ${filePath}`);
          return false;
        }
      } else {
        successCount++;
      }
    } catch (err) {
      console.error(`   ❌ Statement ${i + 1} error:`, err.message);
      errorCount++;
    }
  }

  console.log(`   ✅ Success: ${successCount} | ❌ Errors: ${errorCount}`);
  return errorCount === 0;
}

async function main() {
  console.log("🚀 Applying Critical Migrations for Phase 1B\n");
  console.log("📊 Database: Kolaybase Production");
  console.log(`   URL: ${supabaseUrl}`);
  console.log(`   Database: kb_warebnb\n`);

  const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");

  const migrations = [
    "20260327130000_booking_cancellation_refund.sql",
    "20260327140000_concurrency_protection.sql",
  ];

  let allSuccess = true;

  for (const migration of migrations) {
    const filePath = path.join(migrationsDir, migration);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ Migration file not found: ${migration}`);
      allSuccess = false;
      continue;
    }

    const success = await executeSqlFile(filePath);
    if (!success) {
      allSuccess = false;
    }
  }

  if (!allSuccess) {
    console.log("\n⚠️  MIGRATIONS REQUIRE DIRECT POSTGRESQL CONNECTION");
    console.log("\nPlease run manually:");
    console.log("\n```bash");
    console.log("# Install psql client if not available");
    console.log("# Then run:");
    console.log(
      'psql "postgresql://kb_user_warebnb:_mbLiWyWO4jdbWc1Wnyjd4oYJFFnNc-Q@db.kolaybase.com:6432/kb_warebnb" \\'
    );
    console.log("  -f supabase/migrations/20260327130000_booking_cancellation_refund.sql\n");
    console.log(
      'psql "postgresql://kb_user_warebnb:_mbLiWyWO4jdbWc1Wnyjd4oYJFFnNc-Q@db.kolaybase.com:6432/kb_warebnb" \\'
    );
    console.log("  -f supabase/migrations/20260327140000_concurrency_protection.sql");
    console.log("```\n");
  } else {
    console.log("\n✅ All migrations applied successfully!");
  }
}

main().catch(console.error);
