const { Pool } = require("pg")

// Simple setup script to test database connection and create tables
async function setup() {
  console.log("🔧 Setting up MindfulSpace database...\n")

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.log("❌ DATABASE_URL environment variable is not set!")
    console.log("💡 Please set your DATABASE_URL environment variable.")
    console.log("   For Neon DB, it should look like:")
    console.log("   postgresql://username:password@host/database?sslmode=require")
    console.log("\n   You can set it by creating a .env file or running:")
    console.log('   export DATABASE_URL="your-database-url-here"')
    return
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  })

  try {
    // Test connection
    console.log("🔌 Testing database connection...")
    await pool.query("SELECT NOW()")
    console.log("✅ Database connection successful!\n")

    // Check if tables exist
    console.log("📋 Checking if tables exist...")
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'moods', 'gratitude', 'journal_entries')
    `)

    if (tableCheck.rows.length === 0) {
      console.log("⚠️  No tables found. You need to run the database.sql file.")
      console.log("💡 Please execute the SQL commands from database.sql in your database.")
    } else {
      console.log("✅ Found tables:", tableCheck.rows.map((r) => r.table_name).join(", "))
    }

    console.log("\n🎉 Setup check complete!")
    console.log("🚀 You can now run: npm start")
  } catch (error) {
    console.error("❌ Setup failed:", error.message)
    console.log("\n💡 Common issues:")
    console.log("   1. DATABASE_URL is incorrect")
    console.log("   2. Database server is not running")
    console.log("   3. Network connectivity issues")
    console.log("   4. Database tables not created yet")
  } finally {
    await pool.end()
  }
}

setup()
