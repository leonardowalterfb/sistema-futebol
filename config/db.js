const { Pool } = require("pg")

const connectionString = process.env.DATABASE_URL

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 5, // 👈 importante pro Render free
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000
})

module.exports = pool