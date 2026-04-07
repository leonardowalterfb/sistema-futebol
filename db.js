const { Pool } = require("pg")

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 5, // 🔥 limite de conexões (IMPORTANTE pro Neon)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
})

pool.on("error", (err) => {
  console.error("🔥 Erro inesperado no pool:", err)
})


module.exports = pool