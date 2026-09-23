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
const jwt = require("jsonwebtoken")
const app = express()

const pool = require("./db")
pool.query("SELECT NOW()")
  .then(() => console.log("✅ Banco conectado"))
  .catch(err => console.error("❌ Erro ao conectar:", err))

app.use(cors())
app.use(express.json())

function verificarToken(req, res, next){

  const authHeader = req.headers.authorization

  if(!authHeader){
    return res.status(401).json({ erro: "Token não enviado" })
  }

  const token = authHeader.split(" ")[1]

  if(!token){
    return res.status(401).json({ erro: "Token inválido" })
  }

  try {

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "segredo_super_forte"
    )

    req.usuario = decoded

    next()

  } catch (err){
    return res.status(401).json({ erro: "Token inválido" })
  }
}

async function verificarAcessoTurma(req, res, next) {

  const turmaId = Number(req.params.turmaId)

  if (!Number.isInteger(turmaId)) {
    return res.status(400).json({
      erro: "Turma inválida"
    })
  }

  try {

    // Verifica se o usuário existe e se é master
    const usuarioResult = await pool.query(
      `SELECT is_master
       FROM usuarios
       WHERE id = $1`,
      [req.usuario.id]
    )

    if (usuarioResult.rows.length === 0) {
      return res.status(401).json({
        erro: "Usuário não encontrado"
      })
    }

    const usuario = usuarioResult.rows[0]

    // Usuário master pode acessar qualquer turma
    if (usuario.is_master === true) {
      return next()
    }

    // Usuário normal precisa possuir vínculo com a turma
    const acesso = await pool.query(
      `SELECT id, perfil, jogador_id
       FROM usuarios_turmas
       WHERE usuario_id = $1
         AND turma_id = $2`,
      [req.usuario.id, turmaId]
    )

    if (acesso.rows.length === 0) {
      return res.status(403).json({
        erro: "Você não tem acesso a esta turma"
      })
    }

    // Guarda o vínculo da turma na requisição
    req.usuarioTurma = acesso.rows[0]

    next()

  } catch (err) {

    console.error("Erro ao verificar acesso à turma:", err)

    return res.status(500).json({
      erro: "Erro ao verificar acesso à turma"
    })
  }
}

async function temPermissao(usuarioId, turmaId, modulo, acao){

  // 🔥 verifica se é master
  const user = await pool.query(
    `SELECT is_master
     FROM usuarios
     WHERE id = $1`,
    [usuarioId]
  )

  if(user.rows[0]?.is_master){
    return true
  }

  // 🔥 verifica a permissão do usuário dentro da turma
  const result = await pool.query(
    `SELECT p.permitido
     FROM permissoes p
     INNER JOIN usuarios_turmas ut
       ON ut.id = p.usuario_turma_id
     WHERE ut.usuario_id = $1
       AND ut.turma_id = $2
       AND p.modulo = $3
       AND p.acao = $4`,
    [usuarioId, turmaId, modulo, acao]
  )

  return result.rows.length > 0 &&
         result.rows[0].permitido === true
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
app.get(
  "/jogadores/:turmaId",
  verificarToken,
  verificarAcessoTurma,
  async (req, res) => {

    try {

      const { turmaId } = req.params

      // JOGADOR
      if(req.usuarioTurma?.perfil === "JOGADOR"){

        const result = await pool.query(
          `SELECT
              nome,
              posicao
           FROM jogadores
           WHERE turma_id = $1
             AND status = 'ativo'
           ORDER BY nome`,
          [turmaId]
        )

        return res.json(result.rows)
      }

      // ADMIN
      const result = await pool.query(
        `SELECT *
         FROM jogadores
         WHERE turma_id = $1
         ORDER BY nome`,
        [turmaId]
      )

      res.json(result.rows)

    } catch (err) {

      console.error("Erro ao buscar jogadores:", err)

      res.status(500).json({
        erro: err.message
      })
    }
  }
)

app.post("/jogadores", verificarToken, async (req, res) => {
  try {

    const j = req.body

    // VALIDA PERMISSÃO
    const usuarioId = req.usuario.id
const pode = await temPermissao(usuarioId, j.turma_id, "jogadores", "cadastrar")

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
   (nome, telefone, cpf, email, nascimento, posicao, nivel, turma_id, data_cadastro, status)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),'ativo')
   RETURNING id`,
  [
    j.nome,
    j.telefone,
    cpfLimpo,
    j.email || null,
    j.nascimento,
    j.posicao,
    j.nivel || "prata",
    j.turma_id
  ]
)

    res.json({ ok: true, id: result.rows[0].id })

  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

app.put("/jogadores/:id", verificarToken, async (req, res) => {
  try {
    const { id } = req.params
    const d = req.body

const usuarioId = req.usuario.id

const jogador = await pool.query(
  `SELECT turma_id
   FROM jogadores
   WHERE id = $1`,
  [id]
)

if (jogador.rows.length === 0) {
  return res.status(404).json({ erro: "Jogador não encontrado" })
}

const turmaId = jogador.rows[0].turma_id

const pode = await temPermissao(
  usuarioId,
  turmaId,
  "jogadores",
  "editar"
)

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
  nome=$1,
  telefone=$2,
  cpf=$3,
  email=$4,
  nascimento=$5,
  posicao=$6,
  nivel=$7
  WHERE id=$8`,
  [
    d.nome,
    d.telefone,
    cpfLimpo,
    d.email || null,
    d.nascimento,
    d.posicao,
    d.nivel || "prata",
    id
  ]
)

    res.json({ ok: true })

  } catch (err) {
    res.status(500).json({ erro: err.message })
  }
})

app.delete("/jogadores/:id", verificarToken, async (req, res) => {
  try {
    const usuarioId = req.usuario.id

const jogador = await pool.query(
  `SELECT turma_id
   FROM jogadores
   WHERE id = $1`,
  [req.params.id]
)

if (jogador.rows.length === 0) {
  return res.status(404).json({ erro: "Jogador não encontrado" })
}

const turmaId = jogador.rows[0].turma_id

const pode = await temPermissao(
  usuarioId,
  turmaId,
  "jogadores",
  "excluir"
)

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
app.get(
  "/pagamentos/:turmaId", verificarToken, verificarAcessoTurma, async (req, res) => {
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

app.post("/pagamentos", verificarToken, async (req, res) => {
  try {

    const usuarioId = req.usuario.id

const { jogador_id, jogador, mes, valor, data, turma_id } = req.body

const pode = await temPermissao(
  usuarioId,
  turma_id,
  "financeiro",
  "registrar"
)

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
    console.error("ERRO PAGAMENTO:", err)
    res.status(500).json({ erro: err.message })
  }
})

app.delete("/pagamentos/:id", verificarToken, async (req, res) => {
  try {

    const usuarioId = req.usuario.id

    const pagamento = await pool.query(
      `SELECT turma_id
       FROM pagamentos
       WHERE id = $1`,
      [req.params.id]
    )

    if (pagamento.rows.length === 0) {
      return res.status(404).json({
        erro: "Pagamento não encontrado"
      })
    }

    const turmaId = pagamento.rows[0].turma_id

    const pode = await temPermissao(
      usuarioId,
      turmaId,
      "financeiro",
      "excluir"
    )

    if(!pode){
      return res.status(403).json({
        erro: "Sem permissão"
      })
    }

    await pool.query(
      "DELETE FROM pagamentos WHERE id=$1",
      [req.params.id]
    )

    res.json({ ok: true })

  } catch (err) {
    console.error("ERRO AO EXCLUIR PAGAMENTO:", err)
    res.status(500).json({
      erro: err.message
    })
  }
})

// ================= DESPESAS =================
app.get("/despesas/:turmaId", verificarToken, verificarAcessoTurma, async (req, res) => {
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

app.post("/despesas", verificarToken, async (req, res) => {
  try {

    const usuarioId = req.usuario.id

const { descricao, valor, data, turma_id } = req.body

const pode = await temPermissao(
  usuarioId,
  turma_id,
  "financeiro",
  "registrar"
)

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
    console.error("ERRO DESPESA:", err)
    res.status(500).json({ erro: err.message })
  }
})

app.delete("/despesas/:id", verificarToken, async (req, res) => {
  try {

    const usuarioId = req.usuario.id

const despesa = await pool.query(
  `SELECT turma_id
   FROM despesas
   WHERE id = $1`,
  [req.params.id]
)

if (despesa.rows.length === 0) {
  return res.status(404).json({
    erro: "Despesa não encontrada"
  })
}

const turmaId = despesa.rows[0].turma_id

const pode = await temPermissao(
  usuarioId,
  turmaId,
  "financeiro",
  "excluir"
)

if(!pode){
  return res.status(403).json({
    erro: "Sem permissão"
  })
}

    await pool.query("DELETE FROM despesas WHERE id=$1", [req.params.id])

    res.json({ ok: true })

  } catch (err) {
    console.error("ERRO DELETE DESPESA:", err)
    res.status(500).json({ erro: err.message })
  }
})

// ================= USUÁRIOS =================
app.get("/usuarios/:turmaId", verificarToken, verificarAcessoTurma, async (req, res) => {
  try {

    const turmaId = Number(req.params.turmaId)

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.nome,
        u.email,
        u.cpf,
        ut.id AS usuario_turma_id,
        ut.perfil,
        ut.jogador_id,
        j.nome AS jogador_nome
      FROM usuarios_turmas ut
      INNER JOIN usuarios u
        ON u.id = ut.usuario_id
      LEFT JOIN jogadores j
        ON j.id = ut.jogador_id
      WHERE ut.turma_id = $1
      ORDER BY u.nome
      `,
      [turmaId]
    )

    res.json(result.rows)

  } catch (err) {

    console.error("ERRO AO CARREGAR USUÁRIOS:", err)

    res.status(500).json({
      erro: "Erro ao carregar usuários"
    })
  }
})

app.post("/usuarios/:turmaId", verificarToken, verificarAcessoTurma, async (req, res) => {
  try {

    const {
      nome,
      email,
      cpf,
      perfil,
      jogador_id
    } = req.body

    const turmaId = Number(req.params.turmaId)

    if (!nome || !nome.trim()) {
      return res.status(400).json({
        erro: "Nome é obrigatório"
      })
    }

    if (!email && !cpf) {
      return res.status(400).json({
        erro: "Informe o e-mail ou CPF"
      })
    }

    if (!["ADMIN", "JOGADOR"].includes(perfil)) {
      return res.status(400).json({
        erro: "Perfil inválido"
      })
    }

    if (perfil === "JOGADOR" && !jogador_id) {
      return res.status(400).json({
        erro: "Selecione o jogador"
      })
    }

    // Apenas administrador ou usuário master pode cadastrar usuários
    if (
      req.usuario.is_master !== true &&
      req.usuarioTurma?.perfil !== "ADMIN"
    ) {
      return res.status(403).json({
        erro: "Você não tem permissão para cadastrar usuários"
      })
    }

    // Verifica se e-mail já existe
    if (email && email.trim()) {

      const emailExistente = await pool.query(
        `
        SELECT id
        FROM usuarios
        WHERE LOWER(email) = LOWER($1)
        `,
        [email.trim()]
      )

      if (emailExistente.rows.length > 0) {
        return res.status(409).json({
          erro: "Este e-mail já está cadastrado"
        })
      }
    }

    // Verifica se CPF já existe
    if (cpf && cpf.trim()) {

      const cpfExistente = await pool.query(
        `
        SELECT id
        FROM usuarios
        WHERE cpf = $1
        `,
        [cpf.trim()]
      )

      if (cpfExistente.rows.length > 0) {
        return res.status(409).json({
          erro: "Este CPF já está cadastrado"
        })
      }
    }

    // Se for jogador, verifica se o jogador pertence à turma
if (jogador_id) {

  const jogador = await pool.query(
    `
    SELECT id
    FROM jogadores
    WHERE id = $1
      AND turma_id = $2
    `,
    [jogador_id, turmaId]
  )

  if (jogador.rows.length === 0) {
    return res.status(400).json({
      erro: "O jogador não pertence a esta turma"
    })
  }

  // Verifica se o jogador já possui uma conta nesta turma
  const usuarioExistente = await pool.query(
    `
    SELECT ut.id
    FROM usuarios_turmas ut
    WHERE ut.jogador_id = $1
      AND ut.turma_id = $2
    `,
    [jogador_id, turmaId]
  )

  if (usuarioExistente.rows.length > 0) {
    return res.status(409).json({
      erro: "Este jogador já possui uma conta de acesso nesta turma"
    })
  }
}

    // Cria o usuário sem senha.
    // Ele deverá definir a senha no primeiro acesso.
    const usuarioResult = await pool.query(
      `
      INSERT INTO usuarios (
        nome,
        email,
        cpf,
        senha,
        primeiro_acesso
      )
      VALUES ($1, $2, $3, NULL, true)
      RETURNING id
      `,
      [
        nome.trim(),
        email ? email.trim() : null,
        cpf ? cpf.trim() : null
      ]
    )

    const usuarioId = usuarioResult.rows[0].id

    // Cria o vínculo do usuário com a turma
    await pool.query(
      `
      INSERT INTO usuarios_turmas (
        usuario_id,
        turma_id,
        perfil,
        jogador_id
      )
      VALUES ($1, $2, $3, $4)
      `,
      [
        usuarioId,
        turmaId,
        perfil,
        jogador_id || null
      ]
    )

    res.json({
      ok: true,
      usuarioId
    })

  } catch (err) {

    console.error("ERRO AO CADASTRAR USUÁRIO:", err)

    res.status(500).json({
      erro: "Erro ao cadastrar usuário"
    })
  }
})

// ===============PERMISSÕES================

app.get("/permissoes/:turmaId", verificarToken, verificarAcessoTurma, async (req, res) => {
  try {

    const turmaId = Number(req.params.turmaId)
    const usuarioId = req.usuario.id

    if(!Number.isInteger(turmaId)){
      return res.status(400).json({
        erro: "Turma inválida"
      })
    }

    const result = await pool.query(
      `SELECT
          p.id,
          p.modulo,
          p.acao,
          p.permitido
       FROM permissoes p
       INNER JOIN usuarios_turmas ut
         ON ut.id = p.usuario_turma_id
       WHERE ut.usuario_id = $1
         AND ut.turma_id = $2
       ORDER BY p.modulo, p.acao`,
      [usuarioId, turmaId]
    )

    res.json(result.rows)

  } catch (err) {

    console.error("ERRO AO CARREGAR PERMISSÕES:", err)

    res.status(500).json({
      erro: err.message
    })
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

    const { identificador, senha } = req.body

    if (!identificador || !senha) {
      return res.status(400).json({
        erro: "Informe CPF ou e-mail e a senha"
      })
    }

    const valor = identificador.trim()

    // 🔎 Procura por e-mail ou CPF
    const result = await pool.query(
      `SELECT *
       FROM usuarios
       WHERE LOWER(email) = LOWER($1)
          OR cpf = $1
       LIMIT 1`,
      [valor]
    )

    const user = result.rows[0]

    if (!user) {
      return res.status(401).json({
        erro: "CPF/e-mail ou senha inválidos"
      })
    }

    // 🔥 PRIMEIRO ACESSO
    if (user.primeiro_acesso) {
      return res.json({
        primeiroAcesso: true,
        usuarioId: user.id
      })
    }

    // 🔐 Verifica senha
    const ok = await bcrypt.compare(senha, user.senha)

    if (!ok) {
      return res.status(401).json({
        erro: "CPF/e-mail ou senha inválidos"
      })
    }

    // 🔎 Busca as turmas do usuário
    const turmasResult = await pool.query(
      `SELECT
          ut.id AS usuario_turma_id,
          ut.turma_id,
          ut.perfil,
          ut.jogador_id,
          t.nome AS turma_nome
       FROM usuarios_turmas ut
       INNER JOIN turmas t
         ON t.id = ut.turma_id
       WHERE ut.usuario_id = $1
       ORDER BY t.nome`,
      [user.id]
    )

    // 🔐 TOKEN
    const token = jwt.sign(
      {
        id: user.id,
        is_master: user.is_master
      },
      process.env.JWT_SECRET || "segredo_super_forte",
      { expiresIn: "7d" }
    )

    // 🔥 SALVAR ACEITE LGPD
    await pool.query(
      "UPDATE usuarios SET aceitou_lgpd = true WHERE id = $1",
      [user.id]
    )

    // Não enviar a senha para o frontend
    const usuario = {
      id: user.id,
      nome: user.nome,
      email: user.email,
      cpf: user.cpf,
      is_master: user.is_master,
      aceitou_lgpd: true,
      primeiro_acesso: user.primeiro_acesso
    }

    res.json({
      ok: true,
      usuario,
      turmas: turmasResult.rows,
      token
    })

  } catch (err) {

    console.error("ERRO LOGIN:", err)

    res.status(500).json({
      erro: err.message
    })
  }
})

// CRIAR SENHA
app.post("/criar-senha", async (req, res) => {
  try {

    const { usuarioId, senha } = req.body

    if (!usuarioId || !senha) {
      return res.status(400).json({
        erro: "Usuário e senha são obrigatórios"
      })
    }

    if (senha.length < 6) {
      return res.status(400).json({
        erro: "A senha deve ter pelo menos 6 caracteres"
      })
    }

    const usuario = await pool.query(
      `SELECT id, primeiro_acesso
       FROM usuarios
       WHERE id = $1`,
      [usuarioId]
    )

    if (usuario.rows.length === 0) {
      return res.status(404).json({
        erro: "Usuário não encontrado"
      })
    }

    if (!usuario.rows[0].primeiro_acesso) {
      return res.status(403).json({
        erro: "Este usuário não está em primeiro acesso"
      })
    }

    const hash = await bcrypt.hash(senha, 10)

    await pool.query(
      `UPDATE usuarios
       SET senha = $1,
           primeiro_acesso = false
       WHERE id = $2`,
      [hash, usuarioId]
    )

    res.json({
      ok: true
    })

  } catch (err) {

    console.error("ERRO AO CRIAR SENHA:", err)

    res.status(500).json({
      erro: err.message
    })
  }
})

//RANKING

app.get("/ranking/:turmaId", verificarToken, verificarAcessoTurma, async (req, res) => {
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

app.get("/jogos/:turmaId", verificarToken, verificarAcessoTurma, async (req, res) => {
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

app.post("/jogos", verificarToken, async (req, res) => {
  try {
    const { data, local, presentes, faltaram, turma_id } = req.body

const usuarioId = req.usuario.id

const pode = await temPermissao(
  usuarioId,
  turma_id,
  "jogos",
  "salvar"
)

if(!pode){
  return res.status(403).json({
    erro: "Sem permissão"
  })
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

app.get("/receitas/:turmaId", verificarToken, verificarAcessoTurma, async (req, res) => {

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

// ================= DASHBOARD =================
app.get("/dashboard/:turmaId", verificarToken, verificarAcessoTurma, async (req, res) => {
  try {
    const { turmaId } = req.params

        // Jogador não pode acessar o dashboard
    if (req.usuarioTurma?.perfil === "JOGADOR") {
      return res.status(403).json({
        erro: "Você não tem permissão para acessar o dashboard"
      })
    }

    // 🔹 TOTAL JOGADORES ATIVOS
    const jogadores = await pool.query(
      "SELECT COUNT(*) FROM jogadores WHERE turma_id = $1 AND status = 'ativo'",
      [turmaId]
    )

    // 🔹 PAGAMENTOS
    const pagamentos = await pool.query(
      "SELECT * FROM pagamentos WHERE turma_id = $1",
      [turmaId]
    )

    // 🔹 DESPESAS
    const despesas = await pool.query(
      "SELECT * FROM despesas WHERE turma_id = $1",
      [turmaId]
    )

    // 🔹 OUTRAS RECEITAS
const receitas = await pool.query(
  "SELECT * FROM receitas WHERE turma_id = $1",
  [turmaId]
)

    // 🔹 CALCULOS
    const quantidadePagamentos = pagamentos.rows.length

    const totalPagamentos = pagamentos.rows.reduce(
  (acc, p) => acc + Number(p.valor),
  0
)
const totalReceitas = receitas.rows.reduce(
  (acc, r) => acc + Number(r.valor),
  0
)
const totalAno = totalPagamentos + totalReceitas

    const totalDespesas = despesas.rows.reduce((acc, d) => acc + Number(d.valor), 0)

    const saldo = totalAno - totalDespesas

    // 🔹 MES ATUAL
    const nomesMeses = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
    ]

    const mesAtual = nomesMeses[new Date().getMonth()]

    const totalPagamentosMes = pagamentos.rows
  .filter(p => p.mes === mesAtual)
  .reduce((acc, p) => acc + Number(p.valor), 0)

const totalReceitasMes = receitas.rows
  .filter(r => {

    let data = new Date(r.data)

    return nomesMeses[data.getMonth()] === mesAtual
  })
  .reduce((acc, r) => acc + Number(r.valor), 0)

const totalMesAtual =
  totalPagamentosMes + totalReceitasMes

    res.json({
      totalJogadores: Number(jogadores.rows[0].count),
      totalPagamentos,
      totalMesAtual,
      totalAno,
      totalDespesas,
      saldo
    })

  } catch (err) {
    console.error("Erro dashboard:", err)
    res.status(500).json({ erro: err.message })
  }
})

// ================= START =================
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT)
})