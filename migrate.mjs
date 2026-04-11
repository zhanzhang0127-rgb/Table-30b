import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  try {
    // Get database URL from environment
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      console.error("❌ DATABASE_URL environment variable is not set");
      process.exit(1);
    }

    console.log("📦 Starting database migration...");
    console.log("🔗 Connecting to database...");

    // Parse the database URL
    const url = new URL(databaseUrl);
    const config = {
      host: url.hostname,
      port: parseInt(url.port || "3306"),
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
    };

    // Create connection with SSL
    const connection = await mysql.createConnection({
      ...config,
      ssl: {
        rejectUnauthorized: false,
      },
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    console.log("✅ Connected to database with SSL");

    // Read and execute migration SQL
    const migrationPath = path.join(__dirname, "drizzle/0001_deep_valeria_richards.sql");
    const migrationSql = fs.readFileSync(migrationPath, "utf-8");

    // Split by statement-breakpoint and execute each statement
    const statements = migrationSql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        const [result] = await connection.execute(statement);
        console.log(`✅ Statement ${i + 1} executed successfully`);
      } catch (error) {
        // Ignore "table already exists" errors
        if (error.message && error.message.includes("already exists")) {
          console.log(`⚠️  Statement ${i + 1}: Table already exists (skipping)`);
        } else if (error.code === "ER_TABLE_EXISTS_ERROR") {
          console.log(`⚠️  Statement ${i + 1}: Table already exists (skipping)`);
        } else {
          console.error(`Error in statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }

    console.log("✅ Database migration completed successfully!");
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

migrate();
