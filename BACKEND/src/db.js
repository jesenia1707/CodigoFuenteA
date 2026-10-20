
const { Pool } = require("pg");
require("dotenv").config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("La variable DATABASE_URL no está configurada");
}

const pool = new Pool({ connectionString });

module.exports = { pool };
