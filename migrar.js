require("dotenv").config()

const sqlite3 = require("sqlite3").verbose()
const { Pool } = require("pg")

const sqlite = new sqlite3.Database("./database.db")

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

// helper sqlite
function querySQLite(sql) {
  return new Promise((resolve, reject) => {
    sqlite.all(sql, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })
}

function formatarData(data) {
  if (!data) return null
  const partes = data.split("/")
  if (partes.length !== 3) return data
  return `${partes[2]}-${partes[1]}-${partes[0]}`
}

async function migrar() {
  console.log("🚀 Iniciando migração...")

  // 🔥 TURMAS
  const turmas = await querySQLite("SELECT * FROM turmas")
  for (const t of turmas) {
    await pool.query(
      `INSERT INTO turmas (id, nome, valor_mensalidade)
       VALUES ($1,$2,$3)
       ON CONFLICT (id) DO NOTHING`,
      [t.id, t.nome, t.valor_mensalidade]
    )
  }
  console.log("✅ Turmas migradas")

  // 🔥 JOGADORES
  const jogadores = await querySQLite("SELECT * FROM jogadores")
  for (const j of jogadores) {
    await pool.query(
      `INSERT INTO jogadores 
      (id,nome,telefone,cpf,nascimento,posicao,data_cadastro,status,turma_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO NOTHING`,
      [
        j.id,
        j.nome,
        j.telefone,
        j.cpf,
        j.nascimento,
        j.posicao,
        j.dataCadastro,
        j.status,
        j.turma_id
      ]
    )
  }
  console.log("✅ Jogadores migrados")

  // 🔥 PAGAMENTOS
  const pagamentos = await querySQLite("SELECT * FROM pagamentos")
  for (const p of pagamentos) {
    await pool.query(
      `INSERT INTO pagamentos 
      (id,jogador_nome,mes,valor,data,turma_id)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO NOTHING`,
      [p.id, p.jogador, p.mes, p.valor, formatarData(p.data), p.turma_id]
    )
  }
  console.log("✅ Pagamentos migrados")

  // 🔥 DESPESAS
  const despesas = await querySQLite("SELECT * FROM despesas")
  for (const d of despesas) {
    await pool.query(
      `INSERT INTO despesas 
      (id,descricao,valor,data,turma_id)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (id) DO NOTHING`,
      [d.id, d.descricao, d.valor, formatarData(d.data), d.turma_id]
    )
  }
  console.log("✅ Despesas migradas")

  // 🔥 USUÁRIOS (AGORA NO LUGAR CERTO)
  const usuarios = await querySQLite("SELECT * FROM usuarios")
  for (const u of usuarios) {
    await pool.query(
      `INSERT INTO usuarios (id, nome, senha, turma_id)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO NOTHING`,
      [u.id, u.nome, u.senha, u.turma_id]
    )
  }
  console.log("✅ Usuários migrados")

  console.log("🎉 MIGRAÇÃO FINALIZADA COM SUCESSO")
}

migrar()