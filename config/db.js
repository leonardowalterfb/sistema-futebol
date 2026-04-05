const { Pool } = require("pg")
const dns = require("dns")

// 🔥 FORÇA IPv4
dns.setDefaultResultOrder("ipv4first")

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  family: 4 // 👈 força IPv4
})

module.exports = pool