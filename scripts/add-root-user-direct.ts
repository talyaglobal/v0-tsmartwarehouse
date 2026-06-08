import "dotenv/config";
import { createConnection } from "mysql2/promise";
import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error("❌ DATABASE_URL not set");
    process.exit(1);
  }

  console.log("Connecting to database...");
  
  try {
    const pool = new Pool({
      connectionString,
    });

    const result = await pool.query(
      `INSERT INTO profiles (id, email, name, role, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET role = $3, updated_at = NOW()
       RETURNING id, email, role`,
      ["info@talya.vc", "Talya Admin", "root"]
    );

    console.log("✅ Root user added/updated successfully!");
    console.log("User:", result.rows[0]);

    await pool.end();
  } catch (error: any) {
    console.error("❌ Error:", error?.message);
    process.exit(1);
  }
}

main();
