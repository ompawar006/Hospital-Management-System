#!/usr/bin/env node

const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

// Load environment variables
require("dotenv").config({ path: "./config.env" });

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  multipleStatements: true,
};

async function setupDatabase() {
  let connection;

  try {
    console.log("Connecting to MySQL...");
    connection = await mysql.createConnection(dbConfig);

    console.log("Dropping existing database if exists...");
    await connection.query("DROP DATABASE IF EXISTS hospital_management");

    console.log("Reading database schema...");
    const schemaPath = path.join(__dirname, "database", "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    console.log("🗄️  Creating database and tables...");
    await connection.query(schema);

    console.log("Database setup completed successfully!");
    console.log("\nNext steps:");
    console.log("1. Update config.env with your database credentials");
    console.log("2. Run: npm start");
    console.log("3. Open http://localhost:3000");
    console.log("\nDefault login credentials:");
    console.log("Username: admin, Password: password");
    console.log("Username: dr_smith, Password: password");
    console.log("Username: nurse_jones, Password: password");
  } catch (error) {
    console.error("Database setup failed:", error.message);
    console.log("\nMake sure:");
    console.log("1. MySQL is running");
    console.log("2. Database credentials in config.env are correct");
    console.log("3. You have permission to create databases");
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Check if config.env exists
if (!fs.existsSync("./config.env")) {
  console.log("config.env not found. Creating from template...");
  const configTemplate = `DB_HOST=localhost
DB_USER=root
DB_PASSWORD=Enter you Pass 
DB_NAME=hospital_management
PORT=3000
JWT_SECRET=your_jwt_secret_key`;

  fs.writeFileSync("./config.env", configTemplate);
  console.log(
    "Please update config.env with your database credentials and run setup again.",
  );
  process.exit(0);
}

setupDatabase();
