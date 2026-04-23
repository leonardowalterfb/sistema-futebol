const dns = require('dns')
dns.setDefaultResultOrder('ipv4first')

require("dotenv").config()

console.log("DATABASE_URL:", process.env.DATABASE_URL)

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL NÃO DEFINIDA")
} else {
  console.log("✅ DATABASE_URL carregada")
}

const express = require("express")
const cors = require("cors")
const bcrypt = require("bcrypt")

const app = express()

const pool = require("./db")
pool.query("SELECT NOW()")
  .then(() => console.log("✅ Banco conectado"))
  .catch(err => console.error("❌ Erro ao conectar:", err))

app.use(cors())
app.use(express.json())

async function temPermissao(usuarioId, modulo, acao){

  // 🔥 verifica se é master
  const user = await pool.query(
    "SELECT is_master FROM usuarios WHERE id = $1",
    [usuarioId]
  )

  if(user.rows[0]?.is_master){
    return true
  }

  // 🔥 verifica permissões normais
  const result = await pool.query(
    `SELECT permitido FROM permissoes 
     WHERE usuario_id = $1 AND modulo = $2 AND acao = $3`,
    [usuarioId, modulo, acao]
  )

  return result.rows.length > 0 && result.rows[0].permitido === true
}

//const db = require("./config/db")

// ================= TESTE =================
app.get("/teste-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()")
    res.json(result.rows)
  } catch (err) {
    console.error("ERRO REAL:", err) // 👈 ISSO AQUI
    res.status(500).json({ erro: err.message })
  }
})

app.get("/teste-jogadores", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM jogadores LIMIT 10")
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: err.message })
  }
})
// ================= JOGADORES =================
app.get("/jogadores/:turmaId", async (req, res) => {
  try {
    const { turmaId } = req.params

    const result = await pool.query(
  "SELECT * FROM jogadores WHERE turma_id = $1 ORDER BY nome",
  [turmaId]
)

    res.json(result.rows)

  } catch (err) {
    console.error("Erro ao buscar jogadores:", err)
    res.status(500).json({ erro: err.message })
  }
})

app.post("/jogadores", async (req, res) => {
  try {

    const j = req.body

    // 🔥 VALIDA PERMISSÃO
    const pode = await temPermissao(j.usuario_id, "jogadores", "cadastrar")

    if(!pode){
      return res.status(403).json({ erro: "Sem permissão" })
    }

    const cpfLimpo = j.cpf.replace(/\D/g, "")

    const existe = await pool.query(
      `SELECT id FROM jogadores 
       WHERE (cpf = $1 OR LOWER(nome) = LOWER($2)) 
       AND turma_id = $3`,
      [cpfLimpo, j.nome, j.turma_id]
    )

    if (existe.rows.length > 0) {
      return res.status(400).json({ erro: "Jogador já existe" })
    }

   const result = await pool.query(
  `INSERT INTO jogadores
   (nome, telefone, cpf, nascimento, posicao, turma_id, data_cadastro, status)
   VALUES ($1,$2,$3,$4,$5,$6,NOW(),'ativo')
   RETURNING id`,
  [
    j.nome,
    j.telefone,
    cpfLimpo,
    j.nascimento,
    j.posicao,
    j.turma_id
  ]
)

    res.json({ ok: true, id: result.rows[0].id })

  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

app.put("/jogadores/:id", async (req, res) => {
  try {
    const { id } = req.params
    const d = req.body

    const pode = await temPermissao(d.usuario_id, "jogadores", "editar")

if(!pode){
  return res.status(403).json({ erro: "Sem permissão" })
}

    if (d.status && !d.cpf) {
      await pool.query(
        "UPDATE jogadores SET status = $1 WHERE id = $2",
        [d.status, id]
      )
      return res.json({ ok: true })
    }

    const cpfLimpo = d.cpf.replace(/\D/g, "")

    await pool.query(
      `UPDATE jogadores SET
      nome=$1, telefone=$2, cpf=$3, nascimento=$4, posicao=$5
      WHERE id=$6`,
      [d.nome, d.telefone, cpfLimpo, d.nascimento, d.posicao, id]
    )

    res.json({ ok: true })

  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

app.delete("/jogadores/:id", async (req, res) => {
  try {
    const { usuario_id } = req.body
    const pode = await temPermissao(usuario_id, "jogadores", "excluir")
    if(!pode){
    return res.status(403).json({ erro: "Sem permissão" })
}
    await pool.query("DELETE FROM jogadores WHERE id=$1", [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ================= PAGAMENTOS =================
app.get("/pagamentos/:turmaId", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM pagamentos WHERE turma_id=$1",
      [req.params.turmaId]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

app.post("/pagamentos", async (req, res) => {
  try {
    const { jogador, jogador_id, mes, valor, data, turma_id, usuario_id } = req.body
    const pode = await temPermissao(usuario_id, "financeiro", "registrar")
    if(!pode){
    return res.status(403).json({ erro: "Sem permissão" })
}

    const existe = await pool.query(
      "SELECT id FROM pagamentos WHERE jogador_nome=$1 AND mes=$2 AND turma_id=$3",
      [jogador, mes, turma_id]
    )

    if (existe.rows.length > 0) {
      return res.status(400).json({ erro: "Pagamento já existe" })
    }

    await pool.query(
  `INSERT INTO pagamentos (jogador_id, jogador_nome, mes, valor, data, turma_id)
   VALUES ($1,$2,$3,$4,$5,$6)`,
  [jogador_id, jogador, mes, valor, data, turma_id]

)

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

app.delete("/pagamentos/:id", async (req, res) => {
  try {
    const { usuario_id } = req.body
    const pode = await temPermissao(usuario_id, "financeiro", "excluir")
    if(!pode){
  return res.status(403).json({ erro: "Sem permissão" })
}
    await pool.query("DELETE FROM pagamentos WHERE id=$1", [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ================= DESPESAS =================
app.get("/despesas/:turmaId", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM despesas WHERE turma_id=$1",
      [req.params.turmaId]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

app.post("/despesas", async (req, res) => {
  try {
    const { descricao, valor, data, turma_id, usuario_id } = req.body
    const pode = await temPermissao(usuario_id, "financeiro", "registrar")
    if(!pode){
  return res.status(403).json({ erro: "Sem permissão" })
}

    await pool.query(
      `INSERT INTO despesas (descricao, valor, data, turma_id)
       VALUES ($1,$2,$3,$4)`,
      [descricao, valor, data, turma_id]
    )

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

app.delete("/despesas/:id", async (req, res) => {
  try {
    const { usuario_id } = req.body
    const pode = await temPermissao(usuario_id, "financeiro", "excluir")
    if(!pode){
  return res.status(403).json({ erro: "Sem permissão" })
}
    await pool.query("DELETE FROM despesas WHERE id=$1", [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ================= USUÁRIOS =================
app.get("/usuarios/:turmaId", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM usuarios WHERE turma_id=$1",
      [req.params.turmaId]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

app.post("/usuarios", async (req, res) => {
  try {
    const { nome, login, senha, turma_id } = req.body

    const hash = await bcrypt.hash(senha, 10)

    await pool.query(
      `INSERT INTO usuarios (nome, login, senha, turma_id)
       VALUES ($1,$2,$3,$4)`,
      [nome, login, hash, turma_id]
    )

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

app.delete("/usuarios/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM usuarios WHERE id=$1", [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ===============PERMISSÕES================

app.get("/permissoes/:usuarioId", async (req, res) => {
  try {

    const { usuarioId } = req.params

    const result = await pool.query(
      "SELECT * FROM permissoes WHERE usuario_id = $1",
      [usuarioId]
    )

    res.json(result.rows)

  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

app.post("/permissoes", async (req, res) => {
  try {

    const { usuario_id, permissoes } = req.body

    // 🔥 apaga antigas
    await pool.query(
      "DELETE FROM permissoes WHERE usuario_id = $1",
      [usuario_id]
    )

    // 🔥 insere novas
    for(let p of permissoes){
      await pool.query(
        `INSERT INTO permissoes (usuario_id, modulo, acao, permitido)
         VALUES ($1,$2,$3,$4)`,
        [usuario_id, p.modulo, p.acao, p.permitido]
      )
    }

    res.json({ ok: true })

  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  try {
    const { login, senha } = req.body

    const result = await pool.query(
  "SELECT * FROM usuarios WHERE login=$1",
  [login]
)

    const user = result.rows[0]

    if (!user) {
      return res.status(401).json({ erro: "Login inválido" })
    }

    const ok = await bcrypt.compare(senha, user.senha)
    //const ok = senha === user.senha

    if (!ok) {
      return res.status(401).json({ erro: "Login inválido" })
    }

    res.json({
      ok: true,
      usuario: user
    })

  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

//RANKING

app.get("/ranking/:turmaId", async (req, res) => {
  try {

    const { turmaId } = req.params

    const jogos = await pool.query(
      "SELECT * FROM jogos WHERE turma_id = $1",
      [turmaId]
    )

    let ranking = {}

    for(let jogo of jogos.rows){

      let presentes = jogo.presentes

      if(typeof presentes === "string"){
        try {
          presentes = JSON.parse(presentes)
        } catch {
          presentes = []
        }
      }

      if(!Array.isArray(presentes)) continue

      for(let nome of presentes){

        if(!ranking[nome]){
          ranking[nome] = 0
        }

        ranking[nome]++
      }
    }

    let resultado = []

    for(let nome in ranking){
      resultado.push({
        nome: nome,
        presencas: ranking[nome]
      })
    }

    res.json(resultado)

  } catch (err) {
    console.error("ERRO RANKING:", err)
    res.status(500).json({ erro: "Erro ao gerar ranking" })
  }
})

//JOGOS

app.get("/jogos/:turmaId", async (req, res) => {
  try {
    const { turmaId } = req.params

    const result = await pool.query(
      "SELECT * FROM jogos WHERE turma_id = $1 ORDER BY data DESC",
      [turmaId]
    )

    res.json(result.rows)

  } catch (err) {
    console.error("ERRO JOGOS:", err)
    res.status(500).json({ erro: "Erro ao buscar jogos" })
  }
})

app.post("/jogos", async (req, res) => {
  try {
    const { data, local, presentes, faltaram, turma_id, usuario_id } = req.body
    const pode = await temPermissao(usuario_id, "jogos", "salvar")
    if(!pode){
    return res.status(403).json({ erro: "Sem permissão" })
}

    const result = await pool.query(
      `INSERT INTO jogos (data, local, presentes, faltaram, turma_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id`,
       [data,
        local,
        JSON.stringify(presentes),
        JSON.stringify(faltaram),
        turma_id]
    )

    res.json({ ok: true, id: result.rows[0].id })

  } catch (err) {
    console.error("ERRO AO SALVAR JOGO:", err)
    res.status(500).json({ erro: err.message })
  }
})

// TURMAS

app.get("/turmas", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM turmas ORDER BY id"
    )

    res.json(result.rows)

  } catch (err) {
    console.error("ERRO TURMAS:", err)
    res.status(500).json({ erro: "Erro ao buscar turmas" })
  }
})


app.get("/turmas/:id", async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(
      "SELECT * FROM turmas WHERE id = $1",
      [id]
    )

    res.json(result.rows[0])

  } catch (err) {
    console.error("ERRO TURMA:", err)
    res.status(500).json({ erro: "Erro ao buscar turma" })
  }
})

// ===============MODALIDADE================

app.put("/turmas/:id", async (req, res) => {

  const { id } = req.params
  const { modalidade } = req.body

  try{

    await pool.query(
      "UPDATE turmas SET modalidade = $1 WHERE id = $2",
      [modalidade, id]
    )

    res.json({ ok: true })

  }catch(err){
    console.log(err)
    res.status(500).json({ erro: "Erro ao atualizar turma" })
  }
})

//============== OUTRAS RECEITAS ================

app.post("/receitas", async (req, res) => {

  const { descricao, valor, turma_id } = req.body

  try{

    await pool.query(
      "INSERT INTO receitas (descricao, valor, turma_id) VALUES ($1,$2,$3)",
      [descricao, valor, turma_id]
    )

    res.json({ ok: true })

  }catch(err){
    res.status(500).json({ erro: "Erro ao salvar receita" })
  }
})

app.get("/receitas/:turmaId", async (req, res) => {

  const { turmaId } = req.params

  try{

    const result = await pool.query(
      "SELECT * FROM receitas WHERE turma_id = $1 ORDER BY data DESC",
      [turmaId]
    )

    res.json(result.rows)

  }catch(err){
    res.status(500).json({ erro: "Erro ao buscar receitas" })
  }
})

app.delete("/receitas/:id", async (req, res) => {

  const { id } = req.params

  try{
    await pool.query("DELETE FROM receitas WHERE id = $1", [id])
    res.json({ ok: true })
  }catch(err){
    res.status(500).json({ erro: "Erro ao excluir receita" })
  }
})

// ================= START =================
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT)
})