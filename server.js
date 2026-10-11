const dns = require('dns')
dns.setDefaultResultOrder('ipv4first')

require("dotenv").config()

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
  process.env.JWT_SECRET
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

    const pode = await temPermissao(
      usuarioId,
      j.turma_id,
      "jogadores",
      "cadastrar"
    )

    if(!pode){
      return res.status(403).json({
        erro: "Sem permissão"
      })
    }

    const cpfLimpo = j.cpf.replace(/\D/g, "")

    // Número da camiseta é opcional
    let numeroCamisa = null

    if(
      j.numero_camisa !== undefined &&
      j.numero_camisa !== null &&
      String(j.numero_camisa).trim() !== ""
    ){

      numeroCamisa = Number(j.numero_camisa)

      if(
        !Number.isInteger(numeroCamisa) ||
        numeroCamisa < 0 ||
        numeroCamisa > 99
      ){
        return res.status(400).json({
          erro: "Número da camiseta inválido"
        })
      }

      // Verifica se o número já está sendo usado na turma
      const existeNumero = await pool.query(
        `SELECT id
         FROM jogadores
         WHERE turma_id = $1
           AND numero_camisa = $2`,
        [
          j.turma_id,
          numeroCamisa
        ]
      )

      if(existeNumero.rows.length > 0){
        return res.status(400).json({
          erro: `O número ${numeroCamisa} já está sendo usado por outro jogador nesta turma.`
        })
      }
    }

    // Verifica CPF ou nome duplicado
    const existe = await pool.query(
      `SELECT id
       FROM jogadores
       WHERE (cpf = $1 OR LOWER(nome) = LOWER($2))
         AND turma_id = $3`,
      [
        cpfLimpo,
        j.nome,
        j.turma_id
      ]
    )

    if(existe.rows.length > 0){
      return res.status(400).json({
        erro: "Jogador já existe"
      })
    }

    const result = await pool.query(
      `INSERT INTO jogadores (
        nome,
        telefone,
        cpf,
        email,
        nascimento,
        posicao,
        nivel,
        numero_camisa,
        turma_id,
        data_cadastro,
        status
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),'ativo'
      )
      RETURNING id`,
      [
        j.nome,
        j.telefone,
        cpfLimpo,
        j.email || null,
        j.nascimento,
        j.posicao,
        j.nivel || "prata",
        numeroCamisa,
        j.turma_id
      ]
    )

    res.json({
      ok: true,
      id: result.rows[0].id
    })

  } catch(err){

    console.error(
      "ERRO AO CADASTRAR JOGADOR:",
      err
    )

    // Segurança extra caso a restrição UNIQUE do banco seja acionada
    if(err.code === "23505"){
      return res.status(400).json({
        erro: "Este número de camiseta já está sendo usado nesta turma."
      })
    }

    res.status(500).json({
      erro: err.message
    })
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
  nivel=$7,
  numero_camisa=$8
  WHERE id=$9`,
  [
    d.nome,
d.telefone,
cpfLimpo,
d.email || null,
d.nascimento,
d.posicao,
d.nivel || "prata",
d.numero_camisa || null,
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

app.delete("/usuarios/:id", verificarToken, async (req, res) => {

  try {

    const usuarioId = Number(req.params.id)

    if(!Number.isInteger(usuarioId)){
      return res.status(400).json({
        erro: "Usuário inválido"
      })
    }

    // Não permite excluir o próprio usuário logado
    if(usuarioId === req.usuario.id){
      return res.status(400).json({
        erro: "Você não pode excluir o próprio usuário"
      })
    }

    // Remove permissões vinculadas aos vínculos do usuário
    await pool.query(
      `
      DELETE FROM permissoes
      WHERE usuario_turma_id IN (
        SELECT id
        FROM usuarios_turmas
        WHERE usuario_id = $1
      )
      `,
      [usuarioId]
    )

    // Remove os vínculos com as turmas
    await pool.query(
      `
      DELETE FROM usuarios_turmas
      WHERE usuario_id = $1
      `,
      [usuarioId]
    )

    // Remove o usuário
    await pool.query(
      `
      DELETE FROM usuarios
      WHERE id = $1
      `,
      [usuarioId]
    )

    res.json({
      ok: true
    })

  } catch(err) {

    console.error("ERRO AO EXCLUIR USUÁRIO:", err)

    res.status(500).json({
      erro: "Erro ao excluir usuário"
    })
  }
})

// ===============PERMISSÕES================

app.get(
  "/permissoes/:turmaId/:usuarioId",
  verificarToken,
  async (req, res) => {

    try {

      const turmaId = Number(req.params.turmaId)
      const usuarioId = Number(req.params.usuarioId)

      if(
        !Number.isInteger(turmaId) ||
        !Number.isInteger(usuarioId)
      ){
        return res.status(400).json({
          erro: "Turma ou usuário inválidos"
        })
      }

      // Verifica se o usuário logado é master
      const usuarioLogado = await pool.query(
        `SELECT is_master
         FROM usuarios
         WHERE id = $1`,
        [req.usuario.id]
      )

      if(usuarioLogado.rows.length === 0){
        return res.status(401).json({
          erro: "Usuário não encontrado"
        })
      }

      const isMaster =
        usuarioLogado.rows[0].is_master === true

      // Se não for master, precisa ser ADMIN da turma
      if(!isMaster){

        const acesso = await pool.query(
          `SELECT id
           FROM usuarios_turmas
           WHERE usuario_id = $1
             AND turma_id = $2
             AND perfil = 'ADMIN'`,
          [
            req.usuario.id,
            turmaId
          ]
        )

        if(acesso.rows.length === 0){
          return res.status(403).json({
            erro: "Somente administradores podem consultar permissões"
          })
        }
      }

      // Verifica se o usuário selecionado pertence à turma
      const usuarioTurma = await pool.query(
        `SELECT id
         FROM usuarios_turmas
         WHERE usuario_id = $1
           AND turma_id = $2`,
        [
          usuarioId,
          turmaId
        ]
      )

      if(usuarioTurma.rows.length === 0){
        return res.status(404).json({
          erro: "Usuário não possui vínculo com esta turma"
        })
      }

      const usuarioTurmaId =
        usuarioTurma.rows[0].id

      const result = await pool.query(
        `SELECT
           modulo,
           acao,
           permitido
         FROM permissoes
         WHERE usuario_turma_id = $1
         ORDER BY modulo, acao`,
        [usuarioTurmaId]
      )

      res.json(result.rows)

    } catch(err) {

      console.error(
        "ERRO AO BUSCAR PERMISSÕES:",
        err
      )

      res.status(500).json({
        erro: "Erro ao buscar permissões"
      })
    }
  }
)

app.post("/permissoes", verificarToken, async (req, res) => {
  try {

    const {
      usuario_id,
      turma_id,
      permissoes
    } = req.body

    const usuarioId = Number(usuario_id)
    const turmaId = Number(turma_id)

    if(
      !Number.isInteger(usuarioId) ||
      !Number.isInteger(turmaId)
    ){
      return res.status(400).json({
        erro: "Usuário ou turma inválidos"
      })
    }

    if(!Array.isArray(permissoes)){
      return res.status(400).json({
        erro: "Lista de permissões inválida"
      })
    }

    // Verifica acesso do usuário logado à turma
    const acesso = await pool.query(
      `SELECT id, perfil
       FROM usuarios_turmas
       WHERE usuario_id = $1
         AND turma_id = $2`,
      [
        req.usuario.id,
        turmaId
      ]
    )

    // Master pode acessar qualquer turma
    const usuarioMaster = await pool.query(
      `SELECT is_master
       FROM usuarios
       WHERE id = $1`,
      [req.usuario.id]
    )

    if(usuarioMaster.rows.length === 0){
      return res.status(401).json({
        erro: "Usuário não encontrado"
      })
    }

    const isMaster =
      usuarioMaster.rows[0].is_master === true

    if(
      !isMaster &&
      (
        acesso.rows.length === 0 ||
        acesso.rows[0].perfil !== "ADMIN"
      )
    ){
      return res.status(403).json({
        erro: "Somente administradores podem alterar permissões"
      })
    }

    // Busca o vínculo do usuário que terá as permissões
    const usuarioTurma = await pool.query(
      `SELECT id
       FROM usuarios_turmas
       WHERE usuario_id = $1
         AND turma_id = $2`,
      [
        usuarioId,
        turmaId
      ]
    )

    if(usuarioTurma.rows.length === 0){
      return res.status(404).json({
        erro: "Usuário não possui vínculo com esta turma"
      })
    }

    const usuarioTurmaId =
      usuarioTurma.rows[0].id

    // Remove as permissões antigas
    await pool.query(
      `DELETE FROM permissoes
       WHERE usuario_turma_id = $1`,
      [usuarioTurmaId]
    )

    // Insere as novas permissões
    for(const p of permissoes){

      if(
        !p ||
        !p.modulo ||
        !p.acao
      ){
        continue
      }

      await pool.query(
        `INSERT INTO permissoes (
          usuario_turma_id,
          modulo,
          acao,
          permitido
        )
        VALUES ($1,$2,$3,$4)`,
        [
          usuarioTurmaId,
          p.modulo,
          p.acao,
          p.permitido === true
        ]
      )
    }

    res.json({
      ok: true
    })

  } catch(err){

    console.error(
      "ERRO AO SALVAR PERMISSÕES:",
      err
    )

    res.status(500).json({
      erro: "Erro ao salvar permissões"
    })
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
  process.env.JWT_SECRET,
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
      `SELECT
         j.*,

         COALESCE(
           (
             SELECT json_agg(
               json_build_object(
                 'jogador_id', c.jogador_id,
                 'jogador_nome', c.jogador_nome,
                 'posicao', c.posicao,
                 'equipe', c.equipe,
                 'ordem', c.ordem
               )
               ORDER BY c.equipe, c.ordem
             )
             FROM composicoes_jogos c
             WHERE c.jogo_id = j.id
           ),
           '[]'::json
         ) AS composicao

       FROM jogos j

       WHERE j.turma_id = $1

       ORDER BY j.data DESC, j.hora DESC`,
      [turmaId]
    )

    res.json(result.rows)

  } catch (err) {

    console.error("ERRO JOGOS:", err)

    res.status(500).json({
      erro: "Erro ao buscar jogos"
    })

  }

})

app.get("/jogos/:id/presencas", verificarToken, async (req, res) => {
  try {

    const jogoId = Number(req.params.id)
    const usuarioId = req.usuario.id

    if(!Number.isInteger(jogoId)){
      return res.status(400).json({
        erro: "ID do jogo inválido"
      })
    }

    const jogo = await pool.query(
  `SELECT
     id,
     turma_id,
     data,
     hora,
     local,
     tipo_jogo,
     status
   FROM jogos
   WHERE id = $1`,
  [jogoId]
)

    if(jogo.rows.length === 0){
      return res.status(404).json({
        erro: "Jogo não encontrado"
      })
    }

    const turmaId = jogo.rows[0].turma_id

    // Verifica acesso à turma
    const acesso = await pool.query(
      `SELECT perfil, jogador_id
       FROM usuarios_turmas
       WHERE usuario_id = $1
         AND turma_id = $2`,
      [usuarioId, turmaId]
    )

    const usuario = await pool.query(
      `SELECT is_master
       FROM usuarios
       WHERE id = $1`,
      [usuarioId]
    )

    if(usuario.rows.length === 0){
      return res.status(401).json({
        erro: "Usuário não encontrado"
      })
    }

    const isMaster = usuario.rows[0].is_master === true

    if(!isMaster && acesso.rows.length === 0){
      return res.status(403).json({
        erro: "Você não tem acesso a esta turma"
      })
    }

    // ADMIN vê todos
    if(isMaster || acesso.rows[0].perfil === "ADMIN"){

const presencas = await pool.query(
  `SELECT
     p.id,
     p.jogador_id,
     p.convidado_id,
     CASE
       WHEN p.convidado_id IS NOT NULL THEN 'CONVIDADO'
       ELSE 'JOGADOR'
     END AS tipo_participante,
     COALESCE(j.nome, c.nome) AS nome,
     COALESCE(j.posicao, c.posicao) AS posicao,
     COALESCE(j.nivel, c.nivel) AS nivel,
     j.numero_camisa,
     p.resposta,
     p.resposta_em,
     p.presente_real
   FROM presencas p
   LEFT JOIN jogadores j
     ON j.id = p.jogador_id
   LEFT JOIN convidados_jogos c
     ON c.id = p.convidado_id
    AND c.jogo_id = p.jogo_id
   WHERE p.jogo_id = $1
   ORDER BY COALESCE(j.nome, c.nome)`,
  [jogoId]
)

      return res.json({
        jogo: jogo.rows[0],
        presencas: presencas.rows
      })
    }

    // JOGADOR vê sua própria resposta // e também quem já confirmou presença
const jogadorId = acesso.rows[0].jogador_id

if(!jogadorId){
  return res.status(403).json({
    erro: "Jogador não vinculado à conta"
  })
}

const presenca = await pool.query(
  `SELECT
     p.id,
     p.jogador_id,
     j.nome,
     p.resposta,
     p.resposta_em,
     p.presente_real
   FROM presencas p
   INNER JOIN jogadores j
     ON j.id = p.jogador_id
   WHERE p.jogo_id = $1
     AND p.jogador_id = $2`,
  [jogoId, jogadorId]
)

const confirmados = await pool.query(
  `SELECT
     COALESCE(j.id, c.id) AS id,
     p.jogador_id,
     p.convidado_id,
     CASE
       WHEN p.convidado_id IS NOT NULL THEN 'CONVIDADO'
       ELSE 'JOGADOR'
     END AS tipo_participante,
     COALESCE(j.nome, c.nome) AS nome
   FROM presencas p
   LEFT JOIN jogadores j
     ON j.id = p.jogador_id
   LEFT JOIN convidados_jogos c
     ON c.id = p.convidado_id
    AND c.jogo_id = p.jogo_id
   WHERE p.jogo_id = $1
     AND p.resposta = 'CONFIRMADO'
   ORDER BY nome`,
  [jogoId]
);

res.json({
  jogo: jogo.rows[0],
  presencas: presenca.rows,
  confirmados: confirmados.rows
})

  } catch(err){

    console.error("ERRO AO BUSCAR PRESENÇAS DO JOGO:", err)

    res.status(500).json({
      erro: "Erro ao buscar presença do jogo"
    })

  }
})


app.put("/jogos/:jogoId/presenca", verificarToken, async (req, res) => {

  try {

    const jogoId = Number(req.params.jogoId)

    const {
      resposta,
      jogador_id,
      convidado_id
    } = req.body

    const usuarioId = req.usuario.id

    if(!Number.isInteger(jogoId)){
      return res.status(400).json({
        erro: "ID do jogo inválido"
      })
    }

    if(!["CONFIRMADO", "RECUSADO", "PENDENTE"].includes(resposta)){
      return res.status(400).json({
        erro: "Resposta inválida"
      })
    }

    // ---------------------------------------------
    // BUSCA O JOGO
    // ---------------------------------------------

    const jogoResult = await pool.query(
      `SELECT
         id,
         data,
         hora,
         turma_id,
         status
       FROM jogos
       WHERE id = $1`,
      [jogoId]
    )

    if(jogoResult.rows.length === 0){
      return res.status(404).json({
        erro: "Jogo não encontrado"
      })
    }

    const jogo = jogoResult.rows[0]

    // Jogo precisa estar agendado
    if(jogo.status !== "AGENDADO"){
      return res.status(403).json({
        erro: "Este jogo já foi finalizado"
      })
    }

    // ---------------------------------------------
    // BUSCA USUÁRIO
    // ---------------------------------------------

    const usuarioResult = await pool.query(
      `SELECT is_master
       FROM usuarios
       WHERE id = $1`,
      [usuarioId]
    )

    if(usuarioResult.rows.length === 0){
      return res.status(401).json({
        erro: "Usuário não encontrado"
      })
    }

    const isMaster =
      usuarioResult.rows[0].is_master === true

    // ---------------------------------------------
    // BUSCA ACESSO À TURMA
    // ---------------------------------------------

    const acesso = await pool.query(
      `SELECT
         perfil,
         jogador_id
       FROM usuarios_turmas
       WHERE usuario_id = $1
         AND turma_id = $2`,
      [usuarioId, jogo.turma_id]
    )

    if(!isMaster && acesso.rows.length === 0){
      return res.status(403).json({
        erro: "Você não tem acesso a esta turma"
      })
    }

    const ehAdmin =
      isMaster ||
      acesso.rows[0]?.perfil === "ADMIN"

    let jogadorId = null
    let convidadoId = null

    // ---------------------------------------------
    // ADMIN
    // ---------------------------------------------

    if(ehAdmin){

      const temJogador =
        jogador_id !== undefined &&
        jogador_id !== null

      const temConvidado =
        convidado_id !== undefined &&
        convidado_id !== null

      if(temJogador === temConvidado){
        return res.status(400).json({
          erro: "Informe jogador_id ou convidado_id"
        })
      }

      // ---------------------------------------------
      // ADMIN - CONVIDADO
      // ---------------------------------------------

      if(temConvidado){

        convidadoId = Number(convidado_id)

        if(!Number.isInteger(convidadoId)){
          return res.status(400).json({
            erro: "convidado_id inválido"
          })
        }

        // Garante que o convidado pertence ao jogo
        const convidadoResult = await pool.query(
          `SELECT id
           FROM convidados_jogos
           WHERE id = $1
             AND jogo_id = $2`,
          [
            convidadoId,
            jogoId
          ]
        )

        if(convidadoResult.rows.length === 0){
          return res.status(403).json({
            erro: "Este convidado não pertence ao jogo"
          })
        }

      }

      // ---------------------------------------------
      // ADMIN - JOGADOR FIXO
      // ---------------------------------------------

      else {

        jogadorId = Number(jogador_id)

        if(!Number.isInteger(jogadorId)){
          return res.status(400).json({
            erro: "jogador_id inválido"
          })
        }

        // Garante que o jogador pertence à turma do jogo
        const jogadorResult = await pool.query(
          `SELECT id
           FROM jogadores
           WHERE id = $1
             AND turma_id = $2`,
          [
            jogadorId,
            jogo.turma_id
          ]
        )

        if(jogadorResult.rows.length === 0){
          return res.status(403).json({
            erro: "Este jogador não pertence à turma do jogo"
          })
        }

      }

    }

    // ---------------------------------------------
    // JOGADOR
    // ---------------------------------------------

    else {

      if(acesso.rows[0].perfil !== "JOGADOR"){
        return res.status(403).json({
          erro: "Somente jogadores podem responder ao convite"
        })
      }

      if(resposta === "PENDENTE"){
        return res.status(403).json({
          erro: "Somente administradores podem voltar uma resposta para pendente"
        })
      }

      jogadorId = acesso.rows[0].jogador_id

      if(!jogadorId){
        return res.status(403).json({
          erro: "Jogador não vinculado à conta"
        })
      }

    }

    // ---------------------------------------------
    // VERIFICA PRAZO
    // ---------------------------------------------

    if(!ehAdmin){

      const agoraPartes = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).formatToParts(new Date())

      const partes = {}

      for(const parte of agoraPartes){

        if(parte.type !== "literal"){
          partes[parte.type] = parte.value
        }

      }

      const agoraComparacao = Date.UTC(
        Number(partes.year),
        Number(partes.month) - 1,
        Number(partes.day),
        Number(partes.hour),
        Number(partes.minute),
        Number(partes.second)
      )

      const horaJogo = jogo.hora
        ? String(jogo.hora).substring(0, 8)
        : "00:00:00"

      const [ano, mes, dia] = String(jogo.data)
        .substring(0, 10)
        .split("-")
        .map(Number)

      const [hora, minuto, segundo] = horaJogo
        .split(":")
        .map(Number)

      const jogoComparacao = Date.UTC(
        ano,
        mes - 1,
        dia,
        hora || 0,
        minuto || 0,
        segundo || 0
      )

      if(agoraComparacao >= jogoComparacao){
        return res.status(403).json({
          erro: "O prazo para responder este jogo já terminou"
        })
      }

    }

    // ---------------------------------------------
    // ATUALIZA PRESENÇA
    // ---------------------------------------------

    let resultado

    if(ehAdmin && convidadoId !== null){

      resultado = await pool.query(
        `UPDATE presencas
         SET resposta = $1,
             resposta_em = CASE
               WHEN $1 = 'PENDENTE' THEN NULL
               ELSE CURRENT_TIMESTAMP
             END
         WHERE jogo_id = $2
           AND convidado_id = $3
         RETURNING
           id,
           jogo_id,
           jogador_id,
           convidado_id,
           resposta,
           resposta_em`,
        [
          resposta,
          jogoId,
          convidadoId
        ]
      )

    } else {

      resultado = await pool.query(
        `UPDATE presencas
         SET resposta = $1,
             resposta_em = CASE
               WHEN $1 = 'PENDENTE' THEN NULL
               ELSE CURRENT_TIMESTAMP
             END
         WHERE jogo_id = $2
           AND jogador_id = $3
         RETURNING
           id,
           jogo_id,
           jogador_id,
           convidado_id,
           resposta,
           resposta_em`,
        [
          resposta,
          jogoId,
          jogadorId
        ]
      )

    }

    if(resultado.rows.length === 0){
      return res.status(404).json({
        erro: "Presença deste participante não encontrada"
      })
    }

    res.json({
      ok: true,
      presenca: resultado.rows[0]
    })

  } catch(err){

    console.error(
      "ERRO AO RESPONDER PRESENÇA:",
      err
    )

    res.status(500).json({
      erro: "Erro ao registrar resposta"
    })

  }

})


app.put("/jogos/:jogoId/finalizar", verificarToken, async (req, res) => {

  const client = await pool.connect()

  let transacaoIniciada = false

  try {

    const jogoId = Number(req.params.jogoId)
    const { presentesReais, composicao } = req.body
    const usuarioId = req.usuario.id

    if(!Number.isInteger(jogoId)){
      return res.status(400).json({
        erro: "ID do jogo inválido"
      })
    }

    if(!Array.isArray(presentesReais)){
      return res.status(400).json({
        erro: "Lista de presentes inválida"
      })
    }

    if(
      !composicao ||
      typeof composicao !== "object" ||
      !composicao.equipes ||
      typeof composicao.equipes !== "object"
    ){
      return res.status(400).json({
        erro: "Composição dos times inválida"
      })
    }

    // ---------------------------------------------
    // BUSCA O JOGO
    // ---------------------------------------------

    const jogoResult = await client.query(
      `SELECT
         id,
         data,
         hora,
         turma_id,
         status
       FROM jogos
       WHERE id = $1`,
      [jogoId]
    )

    if(jogoResult.rows.length === 0){
      return res.status(404).json({
        erro: "Jogo não encontrado"
      })
    }

    const jogo = jogoResult.rows[0]

    if(jogo.status !== "AGENDADO"){
      return res.status(403).json({
        erro: "Este jogo já foi finalizado"
      })
    }

    // ---------------------------------------------
    // VERIFICA USUÁRIO
    // ---------------------------------------------

    const usuario = await client.query(
      `SELECT is_master
       FROM usuarios
       WHERE id = $1`,
      [usuarioId]
    )

    if(usuario.rows.length === 0){
      return res.status(401).json({
        erro: "Usuário não encontrado"
      })
    }

    const isMaster = usuario.rows[0].is_master === true

    // ---------------------------------------------
    // VERIFICA ACESSO À TURMA
    // ---------------------------------------------

    const acesso = await client.query(
      `SELECT perfil
       FROM usuarios_turmas
       WHERE usuario_id = $1
         AND turma_id = $2`,
      [usuarioId, jogo.turma_id]
    )

    if(!isMaster && acesso.rows.length === 0){
      return res.status(403).json({
        erro: "Você não tem acesso a esta turma"
      })
    }

    // Somente ADMIN pode finalizar
    if(!isMaster && acesso.rows[0].perfil !== "ADMIN"){
      return res.status(403).json({
        erro: "Somente administradores podem finalizar jogos"
      })
    }

    // ---------------------------------------------
    // VERIFICA PERMISSÃO SALVAR JOGO
    // ---------------------------------------------

    const pode = await temPermissao(
      usuarioId,
      jogo.turma_id,
      "jogos",
      "salvar"
    )

    if(!pode){
      return res.status(403).json({
        erro: "Sem permissão para salvar o jogo"
      })
    }

    // ---------------------------------------------
    // VERIFICA SE O JOGO JÁ OCORREU
    // ---------------------------------------------

    const agoraPartes = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(new Date())

    const partes = {}

    for(const parte of agoraPartes){
      if(parte.type !== "literal"){
        partes[parte.type] = parte.value
      }
    }

    const agoraComparacao = Date.UTC(
      Number(partes.year),
      Number(partes.month) - 1,
      Number(partes.day),
      Number(partes.hour),
      Number(partes.minute),
      Number(partes.second)
    )

    const horaJogo = jogo.hora
      ? String(jogo.hora).substring(0, 8)
      : "00:00:00"

    const [ano, mes, dia] = String(jogo.data)
      .substring(0, 10)
      .split("-")
      .map(Number)

    const [hora, minuto, segundo] = horaJogo
      .split(":")
      .map(Number)

    const jogoComparacao = Date.UTC(
      ano,
      mes - 1,
      dia,
      hora || 0,
      minuto || 0,
      segundo || 0
    )

    if(agoraComparacao < jogoComparacao){
      return res.status(403).json({
        erro: "O jogo ainda não ocorreu"
      })
    }

    // ---------------------------------------------
    // BUSCA TODAS AS PRESENÇAS DO JOGO
    // ---------------------------------------------

    const presencasResult = await client.query(
      `SELECT
         p.jogador_id,
         p.convidado_id,
         COALESCE(j.nome, c.nome) AS nome,
         COALESCE(j.posicao, c.posicao) AS posicao,
         COALESCE(j.nivel, c.nivel) AS nivel,
         CASE
           WHEN p.convidado_id IS NOT NULL THEN 'CONVIDADO'
           ELSE 'JOGADOR'
         END AS tipo_participante
       FROM presencas p
       LEFT JOIN jogadores j
         ON j.id = p.jogador_id
       LEFT JOIN convidados_jogos c
         ON c.id = p.convidado_id
        AND c.jogo_id = p.jogo_id
       WHERE p.jogo_id = $1
       ORDER BY nome`,
      [jogoId]
    )

    // ---------------------------------------------
    // VERIFICA RESPOSTAS PENDENTES
    // ---------------------------------------------

    const pendentesResult = await client.query(
      `SELECT COUNT(*) AS total
       FROM presencas
       WHERE jogo_id = $1
         AND resposta = 'PENDENTE'`,
      [jogoId]
    )

    const totalPendentes = Number(pendentesResult.rows[0].total)

    if(totalPendentes > 0){
      return res.status(400).json({
        erro: `Ainda existem ${totalPendentes} participante(s) pendente(s). Todos precisam confirmar ou recusar antes de finalizar o jogo.`
      })
    }

    // ---------------------------------------------
    // NORMALIZA IDENTIFICAÇÃO DOS PARTICIPANTES
    // ---------------------------------------------

    const chaveParticipante = participante => {
      if(
        participante &&
        typeof participante === "object" &&
        participante.tipo === "CONVIDADO"
      ){
        return `C:${Number(participante.id)}`
      }

      if(
        participante &&
        typeof participante === "object" &&
        participante.tipo === "JOGADOR"
      ){
        return `J:${Number(participante.id)}`
      }

      // Compatibilidade com IDs numéricos antigos
      return `J:${Number(participante)}`
    }

    const chaveDaPresenca = presenca => {
      return presenca.convidado_id !== null
        ? `C:${Number(presenca.convidado_id)}`
        : `J:${Number(presenca.jogador_id)}`
    }

    const participantesDoJogo = new Map(
      presencasResult.rows.map(p => [
        chaveDaPresenca(p),
        p
      ])
    )

    const presentesIds = new Set(
      presentesReais.map(chaveParticipante)
    )

    // Garante que todos os presentes informados pertencem ao jogo
    for(const chave of presentesIds){
      if(!participantesDoJogo.has(chave)){
        return res.status(400).json({
          erro: `Participante ${chave} não pertence a este jogo`
        })
      }
    }

    // ---------------------------------------------
    // VALIDA COMPOSIÇÃO DOS TIMES
    // ---------------------------------------------

    const participantesNaComposicao = new Set()

    for(const equipe of Object.keys(composicao.equipes)){

      const equipeNumero = Number(equipe)
      const participantesEquipe = composicao.equipes[equipe]

      if(
        !Number.isInteger(equipeNumero) ||
        equipeNumero < 1 ||
        !Array.isArray(participantesEquipe)
      ){
        return res.status(400).json({
          erro: "Composição de equipe inválida"
        })
      }

      for(const participante of participantesEquipe){

        const chave = chaveParticipante(participante)

        if(!presentesIds.has(chave)){
          return res.status(400).json({
            erro: `Participante ${chave} não está entre os presentes`
          })
        }

        if(!participantesDoJogo.has(chave)){
          return res.status(400).json({
            erro: `Participante ${chave} não pertence a este jogo`
          })
        }

        if(participantesNaComposicao.has(chave)){
          return res.status(400).json({
            erro: `Participante ${chave} aparece mais de uma vez na composição`
          })
        }

        participantesNaComposicao.add(chave)
      }
    }

    // ---------------------------------------------
    // INICIA TRANSAÇÃO
    // ---------------------------------------------

    await client.query("BEGIN")
    transacaoIniciada = true

    const nomesPresentes = []
    const nomesFaltaram = []

    // ---------------------------------------------
    // REGISTRA PRESENÇA REAL
    // ---------------------------------------------

    for(const presenca of presencasResult.rows){

      const chave = chaveDaPresenca(presenca)
      const foi = presentesIds.has(chave)

      if(presenca.convidado_id !== null){

        await client.query(
          `UPDATE presencas
           SET presente_real = $1
           WHERE jogo_id = $2
             AND convidado_id = $3`,
          [
            foi,
            jogoId,
            presenca.convidado_id
          ]
        )

        await client.query(
          `UPDATE convidados_jogos
           SET presente_real = $1
           WHERE id = $2
             AND jogo_id = $3`,
          [
            foi,
            presenca.convidado_id,
            jogoId
          ]
        )

      } else {

        await client.query(
          `UPDATE presencas
           SET presente_real = $1
           WHERE jogo_id = $2
             AND jogador_id = $3`,
          [
            foi,
            jogoId,
            presenca.jogador_id
          ]
        )

      }

      if(foi){
        nomesPresentes.push(presenca.nome)
      } else {
        nomesFaltaram.push(presenca.nome)
      }
    }

    // ---------------------------------------------
    // FINALIZA O JOGO
    // ---------------------------------------------

    await client.query(
      `UPDATE jogos
       SET status = 'FINALIZADO',
           presentes = $1,
           faltaram = $2
       WHERE id = $3`,
      [
        JSON.stringify(nomesPresentes),
        JSON.stringify(nomesFaltaram),
        jogoId
      ]
    )

    // ---------------------------------------------
    // SALVA A COMPOSIÇÃO FINAL DO JOGO
    // ---------------------------------------------

    await client.query(
      `DELETE FROM composicoes_jogos
       WHERE jogo_id = $1`,
      [jogoId]
    )

    for(const equipe of Object.keys(composicao.equipes)){

      const equipeNumero = Number(equipe)
      const participantesEquipe = composicao.equipes[equipe]

      for(let i = 0; i < participantesEquipe.length; i++){

        const participante = participantesEquipe[i]
        const chave = chaveParticipante(participante)
        const participanteFinal = participantesDoJogo.get(chave)

        if(!participanteFinal){
          throw new Error(
            `Participante ${chave} não encontrado nas presenças`
          )
        }

        if(participanteFinal.convidado_id !== null){

          await client.query(
            `INSERT INTO composicoes_jogos (
               jogo_id,
               jogador_id,
               convidado_id,
               jogador_nome,
               posicao,
               equipe,
               ordem
             )
             VALUES ($1, NULL, $2, $3, $4, $5, $6)`,
            [
              jogoId,
              participanteFinal.convidado_id,
              participanteFinal.nome,
              participanteFinal.posicao || null,
              equipeNumero,
              i + 1
            ]
          )

        } else {

          await client.query(
            `INSERT INTO composicoes_jogos (
               jogo_id,
               jogador_id,
               convidado_id,
               jogador_nome,
               posicao,
               equipe,
               ordem
             )
             VALUES ($1, $2, NULL, $3, $4, $5, $6)`,
            [
              jogoId,
              participanteFinal.jogador_id,
              participanteFinal.nome,
              participanteFinal.posicao || null,
              equipeNumero,
              i + 1
            ]
          )

        }
      }
    }

    await client.query("COMMIT")
    transacaoIniciada = false

    return res.json({
      ok: true,
      id: jogoId,
      status: "FINALIZADO",
      presentes: nomesPresentes,
      faltaram: nomesFaltaram
    })

  } catch(err){

    if(transacaoIniciada){
      await client.query("ROLLBACK")
    }

    console.error(
      "ERRO AO FINALIZAR JOGO:",
      err
    )

    return res.status(500).json({
      erro: "Erro ao finalizar jogo"
    })

  } finally {

    client.release()

  }

})

app.post("/jogos/:jogoId/convidados", verificarToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const jogoId = Number(req.params.jogoId);
    const usuarioId = req.usuario.id;

    const nome = String(req.body.nome || "").trim();
    const posicao = String(req.body.posicao || "").trim();

    if (!Number.isInteger(jogoId)) {
      return res.status(400).json({ erro: "ID do jogo inválido" });
    }

    if (!nome) {
      return res.status(400).json({ erro: "Informe o nome do convidado" });
    }

    if (nome.length > 120 || posicao.length > 80) {
      return res.status(400).json({
        erro: "Nome ou posição excede o limite permitido"
      });
    }

    const jogoResult = await client.query(
      `SELECT id, turma_id, status
       FROM jogos
       WHERE id = $1`,
      [jogoId]
    );

    if (jogoResult.rows.length === 0) {
      return res.status(404).json({ erro: "Jogo não encontrado" });
    }

    const jogo = jogoResult.rows[0];

    if (jogo.status !== "AGENDADO") {
      return res.status(403).json({
        erro: "Não é possível adicionar convidados a um jogo finalizado"
      });
    }

    const usuarioResult = await client.query(
      `SELECT is_master
       FROM usuarios
       WHERE id = $1`,
      [usuarioId]
    );

    if (usuarioResult.rows.length === 0) {
      return res.status(401).json({ erro: "Usuário não encontrado" });
    }

    const isMaster = usuarioResult.rows[0].is_master === true;

    const acesso = await client.query(
      `SELECT perfil
       FROM usuarios_turmas
       WHERE usuario_id = $1
         AND turma_id = $2`,
      [usuarioId, jogo.turma_id]
    );

    if (!isMaster && acesso.rows.length === 0) {
      return res.status(403).json({
        erro: "Você não tem acesso a esta turma"
      });
    }

    if (!isMaster && acesso.rows[0].perfil !== "ADMIN") {
      return res.status(403).json({
        erro: "Somente administradores podem adicionar convidados"
      });
    }

    const pode = await temPermissao(
      usuarioId,
      jogo.turma_id,
      "jogos",
      "salvar"
    );

    if (!pode) {
      return res.status(403).json({
        erro: "Sem permissão para adicionar convidados"
      });
    }

    await client.query("BEGIN");

    const convidadoResult = await client.query(
      `INSERT INTO convidados_jogos
         (jogo_id, nome, posicao, nivel)
       VALUES ($1, $2, $3, 'Prata')
       RETURNING id, jogo_id, nome, posicao, nivel`,
      [jogoId, nome, posicao || null]
    );

    const convidado = convidadoResult.rows[0];

    await client.query(
      `INSERT INTO presencas
         (jogo_id, jogador_id, convidado_id, resposta)
       VALUES ($1, NULL, $2, 'CONFIRMADO')`,
      [jogoId, convidado.id]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      ok: true,
      convidado,
      resposta: "CONFIRMADO"
    });

  } catch (err) {
    await client.query("ROLLBACK");

    console.error("ERRO AO ADICIONAR CONVIDADO:", err);

    return res.status(500).json({
      erro: "Erro ao adicionar convidado"
    });

  } finally {
    client.release();
  }
});

app.post("/jogos", verificarToken, async (req, res) => {
  const client = await pool.connect()

  try {

    const {
      data,
      hora,
      local,
      turma_id,
      tipo_jogo
    } = req.body

    const usuarioId = req.usuario.id
    const turmaId = Number(turma_id)

    const tipoJogo = tipo_jogo || "rachao"

    if(!Number.isInteger(turmaId)){
      return res.status(400).json({
        erro: "Turma inválida"
      })
    }

    if(!data || !hora || !local){
      return res.status(400).json({
        erro: "Data, hora e local são obrigatórios"
      })
    }

    if(!["rachao", "desafio"].includes(tipoJogo)){
      return res.status(400).json({
        erro: "Tipo de jogo inválido"
      })
    }

    // Verifica se o usuário realmente pertence à turma
    const acesso = await client.query(
      `SELECT perfil
       FROM usuarios_turmas
       WHERE usuario_id = $1
         AND turma_id = $2`,
      [usuarioId, turmaId]
    )

    // MASTER pode acessar qualquer turma
    const usuario = await client.query(
      `SELECT is_master
       FROM usuarios
       WHERE id = $1`,
      [usuarioId]
    )

    if(usuario.rows.length === 0){
      return res.status(401).json({
        erro: "Usuário não encontrado"
      })
    }

    const isMaster = usuario.rows[0].is_master === true

    if(!isMaster && acesso.rows.length === 0){
      return res.status(403).json({
        erro: "Você não tem acesso a esta turma"
      })
    }

    // Somente ADMIN pode criar jogo
    if(!isMaster && acesso.rows[0].perfil !== "ADMIN"){
      return res.status(403).json({
        erro: "Somente administradores podem criar jogos"
      })
    }

    // Verifica a permissão específica
    const pode = await temPermissao(
      usuarioId,
      turmaId,
      "jogos",
      "criar"
    )

    if(!pode){
      return res.status(403).json({
        erro: "Sem permissão"
      })
    }

    await client.query("BEGIN")

    // Cria o jogo
    const result = await client.query(
      `INSERT INTO jogos (
        data,
        hora,
        local,
        turma_id,
        tipo_jogo,
        status
      )
      VALUES ($1,$2,$3,$4,$5,'AGENDADO')
      RETURNING id`,
      [
        data,
        hora,
        local.trim(),
        turmaId,
        tipoJogo
      ]
    )

    const jogoId = result.rows[0].id

    // Cria uma presença pendente para cada jogador ativo da turma
    await client.query(
      `INSERT INTO presencas (
        jogo_id,
        jogador_id,
        resposta
      )
      SELECT
        $1,
        j.id,
        'PENDENTE'
      FROM jogadores j
      WHERE j.turma_id = $2
        AND j.status = 'ativo'`,
      [
        jogoId,
        turmaId
      ]
    )

    await client.query("COMMIT")

    res.status(201).json({
      ok: true,
      id: jogoId
    })

  } catch (err) {

    await client.query("ROLLBACK")

    console.error("ERRO AO CRIAR JOGO:", err)

    res.status(500).json({
      erro: err.message
    })

  } finally {

    client.release()

  }
})

// EXCLUIR JOGO
app.delete("/jogos/:id", verificarToken, async (req, res) => {

  try {

    const jogoId = Number(req.params.id)
    const usuarioId = req.usuario.id

    if(!Number.isInteger(jogoId)){
      return res.status(400).json({
        erro: "ID do jogo inválido"
      })
    }

    // Busca o jogo e identifica a turma dele
    const jogo = await pool.query(
      `SELECT id, turma_id
       FROM jogos
       WHERE id = $1`,
      [jogoId]
    )

    if(jogo.rows.length === 0){
      return res.status(404).json({
        erro: "Jogo não encontrado"
      })
    }

    const turmaId = jogo.rows[0].turma_id

    // Verifica se o usuário é master
    const usuario = await pool.query(
      `SELECT is_master
       FROM usuarios
       WHERE id = $1`,
      [usuarioId]
    )

    if(usuario.rows.length === 0){
      return res.status(401).json({
        erro: "Usuário não encontrado"
      })
    }

    const isMaster = usuario.rows[0].is_master === true

    // Verifica acesso do usuário à turma
    const acesso = await pool.query(
      `SELECT perfil
       FROM usuarios_turmas
       WHERE usuario_id = $1
         AND turma_id = $2`,
      [usuarioId, turmaId]
    )

    if(!isMaster && acesso.rows.length === 0){
      return res.status(403).json({
        erro: "Você não tem acesso a esta turma"
      })
    }

    // Somente ADMIN pode excluir
    if(!isMaster && acesso.rows[0].perfil !== "ADMIN"){
      return res.status(403).json({
        erro: "Somente administradores podem excluir jogos"
      })
    }

    // Verifica permissão específica
    const pode = await temPermissao(
      usuarioId,
      turmaId,
      "jogos",
      "excluir"
    )

    if(!pode){
      return res.status(403).json({
        erro: "Sem permissão"
      })
    }

    // Exclui o jogo
    await pool.query(
      `DELETE FROM jogos
       WHERE id = $1
         AND turma_id = $2`,
      [jogoId, turmaId]
    )

    res.json({
      ok: true
    })

  } catch(err) {

    console.error("ERRO AO EXCLUIR JOGO:", err)

    res.status(500).json({
      erro: err.message
    })

  }

})

// AVALIAÇÕES JOGOS

app.get("/avaliacoes/pendentes/:turmaId", verificarToken, async (req, res) => {

  try {

    const turmaId = Number(req.params.turmaId)
    const usuarioId = req.usuario.id

    if(!Number.isInteger(turmaId)){
      return res.status(400).json({
        erro: "Turma inválida"
      })
    }

    // Identifica o jogador vinculado à conta nesta turma
    const vinculo = await pool.query(
      `SELECT jogador_id
       FROM usuarios_turmas
       WHERE usuario_id = $1
         AND turma_id = $2`,
      [usuarioId, turmaId]
    )

    if(
      vinculo.rows.length === 0 ||
      !vinculo.rows[0].jogador_id
    ){
      return res.json([])
    }

    const jogadorId = vinculo.rows[0].jogador_id

    // Busca jogos finalizados, com presença real,
    // que ainda não foram avaliados por este jogador
    const resultado = await pool.query(
      `SELECT
         j.id AS jogo_id,
         j.data,
         j.hora,
         j.local,
         j.tipo_jogo
       FROM jogos j
       INNER JOIN presencas p
         ON p.jogo_id = j.id
       LEFT JOIN avaliacoes_jogos a
         ON a.jogo_id = j.id
         AND a.jogador_id = p.jogador_id
       WHERE j.turma_id = $1
         AND p.jogador_id = $2
         AND j.status = 'FINALIZADO'
         AND p.presente_real = TRUE
         AND a.id IS NULL
       ORDER BY j.data DESC, j.hora DESC`,
      [turmaId, jogadorId]
    )

    res.json(resultado.rows)

  } catch(err) {

    console.error(
      "ERRO AO BUSCAR AVALIAÇÕES PENDENTES:",
      err
    )

    res.status(500).json({
      erro: "Erro ao buscar avaliações pendentes"
    })

  }

})

app.post("/avaliacoes", verificarToken, async (req, res) => {

  try {

    const usuarioId = req.usuario.id

    const {
      jogo_id,
      nota_equipe,
      nota_defesa,
      nota_ataque,
      nota_organizacao,
      nota_adversario,
      nota_nivel_jogo,
      comentario
    } = req.body

    const jogoId = Number(jogo_id)

    if(!Number.isInteger(jogoId)){
      return res.status(400).json({
        erro: "Jogo inválido"
      })
    }

    const notas = [
      nota_equipe,
      nota_defesa,
      nota_ataque,
      nota_organizacao,
      nota_adversario,
      nota_nivel_jogo
    ]

    if(!notas.every(nota =>
      Number.isInteger(nota) &&
      nota >= 1 &&
      nota <= 5
    )){
      return res.status(400).json({
        erro: "Todas as notas devem ser de 1 a 5"
      })
    }

    // Identifica o jogador vinculado à conta
    const vinculo = await pool.query(
      `SELECT jogador_id
       FROM usuarios_turmas
       WHERE usuario_id = $1
         AND turma_id = (
           SELECT turma_id
           FROM jogos
           WHERE id = $2
         )`,
      [usuarioId, jogoId]
    )

    if(
      vinculo.rows.length === 0 ||
      !vinculo.rows[0].jogador_id
    ){
      return res.status(403).json({
        erro: "Jogador não vinculado à turma deste jogo"
      })
    }

    const jogadorId = vinculo.rows[0].jogador_id

    // Confirma que o jogo foi finalizado e
    // que o jogador esteve presente de verdade
    const presenca = await pool.query(
      `SELECT j.id
       FROM jogos j
       INNER JOIN presencas p
         ON p.jogo_id = j.id
       WHERE j.id = $1
         AND j.status = 'FINALIZADO'
         AND p.jogador_id = $2
         AND p.presente_real = TRUE`,
      [jogoId, jogadorId]
    )

    if(presenca.rows.length === 0){
      return res.status(403).json({
        erro: "Você não pode avaliar este jogo"
      })
    }

    const resultado = await pool.query(
      `INSERT INTO avaliacoes_jogos (
         jogo_id,
         jogador_id,
         nota_equipe,
         nota_defesa,
         nota_ataque,
         nota_organizacao,
         nota_adversario,
         nota_nivel_jogo,
         comentario
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (jogo_id, jogador_id) DO NOTHING
       RETURNING id`,
      [
        jogoId,
        jogadorId,
        nota_equipe,
        nota_defesa,
        nota_ataque,
        nota_organizacao,
        nota_adversario,
        nota_nivel_jogo,
        typeof comentario === "string"
          ? comentario.trim().slice(0, 2000)
          : null
      ]
    )

    if(resultado.rows.length === 0){
      return res.status(409).json({
        erro: "Você já avaliou este jogo"
      })
    }

    res.status(201).json({
      ok: true,
      mensagem: "Avaliação registrada com sucesso"
    })

  } catch(err) {

    console.error("ERRO AO SALVAR AVALIAÇÃO:", err)

    res.status(500).json({
      erro: "Erro ao salvar avaliação"
    })

  }

})


app.get("/avaliacoes/:jogoId", verificarToken, async (req, res) => {

  try {

    const jogoId = Number(req.params.jogoId)

    if (!Number.isInteger(jogoId) || jogoId <= 0) {
      return res.status(400).json({
        erro: "Jogo inválido"
      })
    }

    const resultado = await pool.query(
      `SELECT
         a.jogo_id,
         a.jogador_id,
         j.nome AS jogador_nome,
         a.nota_equipe,
         a.nota_defesa,
         a.nota_ataque,
         a.nota_organizacao,
         a.nota_adversario,
         a.nota_nivel_jogo,
         a.comentario
       FROM avaliacoes_jogos a
       INNER JOIN jogadores j
         ON j.id = a.jogador_id
       INNER JOIN jogos jo
         ON jo.id = a.jogo_id
       WHERE a.jogo_id = $1
       ORDER BY j.nome ASC`,
      [jogoId]
    )

    res.json(resultado.rows)

  } catch (err) {

    console.error("ERRO AO CONSULTAR AVALIAÇÕES:", err)

    res.status(500).json({
      erro: "Erro ao consultar avaliações"
    })

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


app.get("/avaliacoes/ranking/:turmaId", verificarToken, async (req, res) => {

  try {

    const turmaId = Number(req.params.turmaId)

    if (!Number.isInteger(turmaId) || turmaId <= 0) {
      return res.status(400).json({
        erro: "Turma inválida"
      })
    }

    const resultado = await pool.query(
      `SELECT
         j.id AS jogo_id,
         j.data,
         j.hora,
         j.local,
         COUNT(a.id)::INTEGER AS total_avaliacoes,
         ROUND(
           AVG(
             (
               a.nota_equipe +
               a.nota_defesa +
               a.nota_ataque +
               a.nota_organizacao +
               a.nota_adversario +
               a.nota_nivel_jogo
             )::NUMERIC / 6
           ),
           2
         ) AS media_geral
       FROM jogos j
       INNER JOIN avaliacoes_jogos a
         ON a.jogo_id = j.id
       WHERE j.turma_id = $1
         AND j.status = 'FINALIZADO'
       GROUP BY j.id, j.data, j.hora, j.local
       ORDER BY j.data DESC, j.hora DESC`,
      [turmaId]
    )

    res.json(resultado.rows)

  } catch (err) {

    console.error("ERRO AO CARREGAR RANKING DE AVALIAÇÕES:", err)

    res.status(500).json({
      erro: "Erro ao carregar ranking de avaliações"
    })

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

// ================= PARTICIPAÇÕES DA TURMA =================
app.get("/dashboard/:turmaId/participacoes", verificarToken, verificarAcessoTurma, async (req, res) => {

  try {

    const { turmaId } = req.params

    // Jogador não pode acessar o dashboard
    if (req.usuarioTurma?.perfil === "JOGADOR") {
      return res.status(403).json({
        erro: "Você não tem permissão para acessar o dashboard"
      })
    }

    
const resultado = await pool.query(
  `SELECT
     COUNT(*) FILTER (
       WHERE p.jogador_id IS NOT NULL
     )::INTEGER AS "totalMensalistas",

     COUNT(*) FILTER (
       WHERE p.convidado_id IS NOT NULL
     )::INTEGER AS "totalConvidados",

     COUNT(DISTINCT j.id)::INTEGER AS "totalJogos"

   FROM presencas p

   INNER JOIN jogos j
     ON j.id = p.jogo_id

   WHERE j.turma_id = $1
     AND j.status = 'FINALIZADO'
     AND p.presente_real = TRUE
     AND j.data >= CURRENT_DATE - INTERVAL '29 days'
     AND j.data < CURRENT_DATE + INTERVAL '1 day'`,
  [turmaId]
)

    res.json(resultado.rows[0])

  } catch (err) {

    console.error("Erro participações dashboard:", err)

    res.status(500).json({
      erro: "Erro ao buscar participações da turma"
    })

  }

})


 // ================= RELATÓRIO DE PARTICIPAÇÕES =================
app.get("/relatorios/:turmaId/participacoes", verificarToken, verificarAcessoTurma, async (req, res) => {

  try {

    const { turmaId } = req.params
    const { dataInicial, dataFinal } = req.query

    // Jogador não pode acessar relatórios administrativos
    if (req.usuarioTurma?.perfil === "JOGADOR") {
      return res.status(403).json({
        erro: "Você não tem permissão para acessar este relatório"
      })
    }

    // Validar período informado
    if (!dataInicial || !dataFinal) {
      return res.status(400).json({
        erro: "Informe a data inicial e a data final"
      })
    }

    if (dataInicial > dataFinal) {
      return res.status(400).json({
        erro: "A data inicial não pode ser posterior à data final"
      })
    }

    const resultado = await pool.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE p.jogador_id IS NOT NULL
         )::INTEGER AS "totalMensalistas",

         COUNT(*) FILTER (
           WHERE p.convidado_id IS NOT NULL
         )::INTEGER AS "totalConvidados"

       FROM presencas p

       INNER JOIN jogos j
         ON j.id = p.jogo_id

       WHERE j.turma_id = $1
         AND j.status = 'FINALIZADO'
         AND p.presente_real = TRUE
         AND j.data >= $2::date
         AND j.data < ($3::date + INTERVAL '1 day')`,
      [turmaId, dataInicial, dataFinal]
    )

    res.json({
      dataInicial,
      dataFinal,
      ...resultado.rows[0]
    })

  } catch (err) {

    console.error("Erro relatório participações:", err)

    res.status(500).json({
      erro: "Erro ao gerar relatório de participações"
    })

  }

})


// ================= START =================
const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT)
})