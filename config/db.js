const sqlite3 = require('sqlite3').verbose()

const db = new sqlite3.Database('./database.db') //('C:/Sistema Futebol/backend/database.db')

db.all("SELECT * FROM jogadores", (err, rows) => {
  console.log("📊 DADOS DIRETO DO BANCO:", rows)
})

module.exports = db