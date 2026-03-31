const express = require('express')
const cors = require('cors')
const bcrypt = require('bcrypt')

const app = express()

app.use(cors())
app.use(express.json())

// ================= BANCO =================
const db = require('./config/db')

async function criarAdminPadrao(){

  const bcrypt = require('bcrypt')

  db.get("SELECT * FROM usuarios WHERE login = ?", ["Admin"], async (err, row) => {

    if(err){
      console.error("Erro ao verificar admin:", err)
      return
    }

    if(!row){

      console.log("🔐 Criando usuário administrador padrão...")

      try {

        const senhaHash = await bcrypt.hash("Admin1995", 10)

        db.run(`
          INSERT INTO usuarios (nome, login, senha, tipo)
          VALUES (?, ?, ?, ?)
        `, ["Administrador", "Admin", senhaHash, "admin"], function(err){

          if(err){
            console.error("Erro ao criar admin:", err)
          } else {
            console.log("✅ Admin criado com sucesso")
          }

        })

      } catch(e){
        console.error("Erro ao gerar hash:", e)
      }

    } else {
      console.log("✔ Admin já existe")
    }

  })

}

//  CRIAR TABELAS BANCO DE DADOS
// JOGADORES
// JOGADORES
db.run(`
CREATE TABLE IF NOT EXISTS jogadores (
  id INTEGER PRIMARY KEY,
  nome TEXT,
  telefone TEXT,
  cpf TEXT,
  nascimento TEXT,
  posicao TEXT,
  dataCadastro TEXT,
  status TEXT,
  turma_id INTEGER
)
`)
// 🔒 TRAVA CPF POR TURMA
db.run(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_jogador_cpf_turma
  ON jogadores (cpf, turma_id)
`)

// 🔒 TRAVA NOME POR TURMA (IGNORANDO MAIÚSCULO/MINÚSCULO)
db.run(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_jogador_nome_turma
  ON jogadores (nome COLLATE NOCASE, turma_id)
`)

db.run(`
CREATE TABLE IF NOT EXISTS pagamentos (
  id INTEGER PRIMARY KEY,
  jogador TEXT,
  mes TEXT,
  valor REAL,
  data TEXT,
  turma_id INTEGER
)
`)

db.run(`
CREATE TABLE IF NOT EXISTS despesas (
  id INTEGER PRIMARY KEY,
  descricao TEXT,
  valor REAL,
  data TEXT,
  turma_id INTEGER
)
`)

db.run(`
CREATE TABLE IF NOT EXISTS jogos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT,
  local TEXT,
  turma_id INTEGER
)
`)

db.run(`
CREATE TABLE IF NOT EXISTS presencas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jogo_id INTEGER,
  jogador_nome TEXT,
  confirmado INTEGER,
  turma_id INTEGER
)
`)
db.run(`
CREATE TABLE IF NOT EXISTS turmas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT
)
`)

// ================= JOGADORES =================

// LISTAR
app.get('/jogadores/:turmaId', (req, res) => {

  const turmaId = req.params.turmaId

  db.all(
    "SELECT * FROM jogadores WHERE turma_id = ?",
    [turmaId],
    (err, rows) => {

      if(err){
        return res.status(500).json(err)
      }

      res.json(rows)
    }
  )

})

// ================= CRIAR JOGADOR (CORRIGIDO) =================
app.post('/jogadores', (req, res) => {

  const j = req.body

  if(!j.nome || !j.cpf){
    return res.status(400).json({ erro: "Nome e CPF são obrigatórios" })
  }

  if(!j.turma_id){
    return res.status(400).json({ erro: "turma_id obrigatório" })
  }

  const cpfLimpo = j.cpf.replace(/\D/g, "")

  // 🔍 verificar duplicidade
  db.get(`
    SELECT id, cpf, nome FROM jogadores 
    WHERE (cpf = ? OR LOWER(nome) = LOWER(?)) 
    AND turma_id = ?
  `,
  [cpfLimpo, j.nome.trim(), j.turma_id],
  (err, existente) => {

    if(err){
      console.error(err)
      return res.status(500).json(err)
    }

    if(existente){
      return res.status(400).json({ erro: "Jogador já cadastrado nessa turma" })
    }

    // ✅ INSERT CORRETO
    db.run(`
      INSERT INTO jogadores (
        nome, telefone, cpf, nascimento, posicao, turma_id, dataCadastro
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `,
    [
      j.nome?.trim() || "",
      j.telefone || "",
      cpfLimpo,
      j.nascimento || "",
      j.posicao || "",
      j.turma_id
    ],
    function(err){

      if(err){
        console.error("ERRO INSERT:", err)

        if(err.code === "SQLITE_CONSTRAINT"){
          return res.status(400).json({ erro: "CPF ou nome já cadastrado" })
        }

        return res.status(500).json(err)
      }

      res.json({ ok: true, id: this.lastID })
    })

  })

})

// DELETAR USUARIOS
app.delete('/usuarios/:id', (req, res) => {

  let id = Number(req.params.id)

  // 🔥 PRIMEIRO BUSCA O USUÁRIO
  db.get("SELECT * FROM usuarios WHERE id = ?", [id], (err, user) => {

    if(err){
      return res.status(500).json({ erro: err.message })
    }

    // 🔐 BLOQUEIA ADMIN
    if(user && user.login === "Admin"){
      return res.status(403).json({ erro: "Não permitido excluir admin" })
    }

    // 🔥 AGORA SIM DELETA
    db.run("DELETE FROM usuarios WHERE id = ?", [id], function(err){

      if(err){
        return res.status(500).json({ erro: err.message })
      }

      res.json({ ok: true })
    })

  })

})

// ================= EDITAR =================
app.put('/jogadores/:id', (req, res) => {

  const id = req.params.id
  const dados = req.body

  // ✅ CASO SEJA SÓ STATUS (INATIVAR)
  if(dados.status && Object.keys(dados).length === 1){

    return db.run(
      "UPDATE jogadores SET status = ? WHERE id = ?",
      [dados.status, id],
      function(err){
        if(err){
          return res.status(500).json(err)
        }

        return res.json({ ok: true })
      }
    )

  }

  // 🔥 SÓ AQUI EXIGE TURMA_ID
  if(!dados.turma_id){
    return res.status(400).json({ erro: "turma_id não informado" })
  }

  const cpfLimpo = dados.cpf.replace(/\D/g, "")

  db.get(`
    SELECT id FROM jogadores 
    WHERE (cpf = ? OR LOWER(nome) = LOWER(?)) 
    AND id != ? 
    AND turma_id = ?
  `,
  [cpfLimpo, dados.nome.trim(), id, dados.turma_id],
  (err, existente) => {

    if(err){
      return res.status(500).json(err)
    }

    if(existente){
      return res.status(400).json({ erro: "CPF ou nome já cadastrado" })
    }

    db.run(`
      UPDATE jogadores SET
      nome = ?,
      telefone = ?,
      cpf = ?,
      nascimento = ?,
      posicao = ?
      WHERE id = ?
    `,
    [
      dados.nome.trim(),
      dados.telefone,
      cpfLimpo,
      dados.nascimento,
      dados.posicao,
      id
    ],
    function(err){

      if(err){
        return res.status(500).json(err)
      }

      res.json({ ok: true })
    })

  })

})

// ================ RANKING ================

app.get('/ranking/:turmaId', (req, res) => {

  const turmaId = req.params.turmaId

  db.all(`
    SELECT jogador_nome AS nome, COUNT(*) AS presencas
    FROM presencas
    WHERE confirmado = 1 AND turma_id = ?
    GROUP BY jogador_nome
    ORDER BY presencas DESC
  `, [turmaId], (err, rows) => {

    if(err){
      return res.status(500).json(err)
    }

    res.json(rows)
  })
})

// ================= SALVAR JOGOS ===============

app.post('/jogos', (req, res) => {

  console.log("🔥 RECEBEU JOGO:", req.body)

  const { data, local, presentes, faltaram, turma_id } = req.body

  if(!data || !local){
    return res.status(400).json({ erro: "Dados inválidos" })
  }

  db.run(`
    INSERT INTO jogos (data, local, turma_id)
    VALUES (?, ?, ?)
  `, [data, local, turma_id], function(err){

    if(err){
      console.error("❌ ERRO AO SALVAR JOGO:", err)
      return res.status(500).json(err)
    }

    const jogoId = this.lastID

    const stmt = db.prepare(`
      INSERT INTO presencas (jogo_id, jogador_nome, confirmado, turma_id)
      VALUES (?, ?, ?, ?)
    `)

    presentes.forEach(nome => {
      stmt.run(jogoId, nome, 1, turma_id)
    })

    faltaram.forEach(nome => {
      stmt.run(jogoId, nome, 0, turma_id)
    })

    stmt.finalize()

    console.log("✅ JOGO SALVO COM ID:", jogoId)

    res.json({ ok: true })
  })
})

// BUSCAR HISTORICO DE JOGOS COMPLETO

app.get('/jogos/:turmaId', (req, res) => {

  const turmaId = req.params.turmaId

  db.all(
    "SELECT * FROM jogos WHERE turma_id = ? ORDER BY id DESC",
    [turmaId],
    (err, jogos) => {

      if(err){
        return res.status(500).json(err)
      }

      let resultado = []
      let pendentes = jogos.length

      if(pendentes === 0){
        return res.json([])
      }

      jogos.forEach(jogo => {

        db.all(
          "SELECT * FROM presencas WHERE jogo_id = ? AND turma_id = ?",
          [jogo.id, turmaId],
          (err, presencas) => {

            let presentes = []
            let faltaram = []

            presencas.forEach(p => {
              if(p.confirmado){
                presentes.push(p.jogador_nome)
              } else {
                faltaram.push(p.jogador_nome)
              }
            })

            resultado.push({
              id: jogo.id,
              data: jogo.data,
              local: jogo.local,
              presentes,
              faltaram
            })

            pendentes--

            if(pendentes === 0){
              res.json(resultado)
            }

          }
        )

      })

    }
  )

})

// DELETE JOGO DO HISTÓRICO 

app.delete('/jogos/:id', (req, res) => {

  const id = req.params.id

  console.log("🗑️ DELETANDO JOGO:", id)

  // 🔥 deleta presenças primeiro
  db.run(
    "DELETE FROM presencas WHERE jogo_id = ?",
    [id],
    function(err){

      if(err){
        return res.status(500).json(err)
      }

      // 🔥 depois deleta o jogo
      db.run(
        "DELETE FROM jogos WHERE id = ?",
        [id],
        function(err){

          if(err){
            return res.status(500).json(err)
          }

          console.log("✅ JOGO DELETADO")

          res.json({ ok: true })
        }
      )

    }
  )

})

// ================= PAGAMENTOS =================

// LISTAR PAGAMENTOS
app.get('/pagamentos/:turmaId', (req, res) => {

  const turmaId = req.params.turmaId

  db.all(
    "SELECT * FROM pagamentos WHERE turma_id = ?",
    [turmaId],
    (err, rows) => {

      if(err){
        console.error(err)
        return res.status(500).json(err)
      }

      res.json(rows)
    }
  )
})

// SALVAR PAGAMENTO

app.post('/pagamentos', (req, res) => {

  const { jogador, mes, valor, data, turma_id } = req.body

  // 🔍 VERIFICA SE JÁ EXISTE (AGORA POR TURMA)
  db.get(
    "SELECT * FROM pagamentos WHERE jogador = ? AND mes = ? AND turma_id = ?",
    [jogador, mes, turma_id],
    (err, row) => {

      if(err){
        console.error(err)
        return res.status(500).json(err)
      }

      if(row){
        return res.status(400).json({ erro: "Pagamento já existe" })
      }

      // 🔥 SALVAR COM TURMA
      db.run(`
        INSERT INTO pagamentos (jogador, mes, valor, data, turma_id)
        VALUES (?, ?, ?, ?, ?)
      `, [jogador, mes, valor, data, turma_id], function(err){

        if(err){
          console.error(err)
          return res.status(500).json(err)
        }

        console.log("SALVANDO PAGAMENTO:", req.body)
        console.log("✅ PAGAMENTO SALVO")

        res.json({ ok: true })
      })

    }
  )

})

// REMOVER PAGAMENTO

app.delete('/pagamentos/:id', (req, res) => {

  const id = req.params.id

  db.run("DELETE FROM pagamentos WHERE id = ?", [id], function(err){

    if(err){
      console.error(err)
      return res.status(500).json(err)
    }

    console.log("✅ PAGAMENTO DELETADO")

    res.json({ ok: true })
  })

})

// ================= DESPESAS =================

app.get('/despesas/:turmaId', (req, res) => {

  const turmaId = req.params.turmaId

  db.all(
    "SELECT * FROM despesas WHERE turma_id = ?",
    [turmaId],
    (err, rows) => {

      if(err){
        console.error(err)
        return res.status(500).json(err)
      }

      res.json(rows)
    }
  )
})
// SALVAR DESPESA

app.post('/despesas', (req, res) => {

  const { descricao, valor, data, turma_id } = req.body

  db.run(`
    INSERT INTO despesas (descricao, valor, data, turma_id)
    VALUES (?, ?, ?, ?)
  `, [descricao, valor, data, turma_id], function(err){

    if(err){
      console.error(err)
      return res.status(500).json(err)
    }

    console.log("✅ DESPESA SALVA")

    res.json({ ok: true })
  })

})

// REMOVER DESPESA

app.delete('/despesas/:id', (req, res) => {

  const id = req.params.id

  console.log("🗑️ DELETANDO DESPESA:", id)

  db.run("DELETE FROM despesas WHERE id = ?", [id], function(err){

    if(err){
      console.error("ERRO AO DELETAR:", err)
      return res.status(500).json(err)
    }

    console.log("✅ DESPESA DELETADA")

    res.json({ ok: true })
  })

})

// LISTAR
app.get('/usuarios/:turmaId', (req, res) => {

  const turmaId = req.params.turmaId

  db.all(
    "SELECT * FROM usuarios WHERE turma_id = ?",
    [turmaId],
    (err, rows) => {

      if(err){
        return res.status(500).json(err)
      }

      res.json(rows)
    }
  )
})

// CADASTRAR
app.post('/usuarios', async (req, res) => {

  try {

    const { nome, login, senha, turma_id } = req.body

    if(!nome || !login || !senha){
      return res.status(400).json({ erro: "Campos obrigatórios" })
    }

    const senhaHash = await bcrypt.hash(senha, 10)

    db.run(`
      INSERT INTO usuarios (nome, login, senha, turma_id)
      VALUES (?, ?, ?, ?)
    `, [nome, login, senhaHash, turma_id], function(err){

      if(err){
        console.error(err)
        return res.status(500).json(err)
      }

      res.json({ ok: true })

    })

  } catch(err) {
    console.error("ERRO AO CADASTRAR USUÁRIO:", err)
    res.status(500).json({ erro: "Erro interno" })
  }

})

app.delete('/usuarios/:id', (req, res) => {

  let id = Number(req.params.id)

  console.log("DELETANDO USUARIO:", id)

  db.run("DELETE FROM usuarios WHERE id = ?", [id], function(err){

    if(err){
      console.error("ERRO SQL:", err)
      return res.status(500).json({ erro: err.message })
    }

    console.log("USUARIO DELETADO COM SUCESSO")

    res.json({ ok: true })
  })

})

app.put('/usuarios/:id', async (req, res) => {

  let id = req.params.id
  let { nome, login, senha } = req.body

  console.log("UPDATE USUARIO:", req.body) // 👈 DEBUG

  try {

    // 🔥 CASO NÃO VENHA SENHA
    if(!senha){

      db.run(`
        UPDATE usuarios 
        SET nome = ?, login = ?
        WHERE id = ?
      `, [nome, login, id], function(err){

        if(err){
          console.error("ERRO UPDATE SEM SENHA:", err)
          return res.status(500).json({ erro: err.message })
        }

        return res.json({ ok: true })
      })

    } else {

      // 🔐 COM SENHA
      const hash = await bcrypt.hash(senha, 10)

      db.run(`
        UPDATE usuarios 
        SET nome = ?, login = ?, senha = ?
        WHERE id = ?
      `, [nome, login, hash, id], function(err){

        if(err){
          console.error("ERRO UPDATE COM SENHA:", err)
          return res.status(500).json({ erro: err.message })
        }

        return res.json({ ok: true })
      })

    }

  } catch(e){
    console.error("ERRO GERAL:", e)
    res.status(500).json({ erro: "Erro interno servidor" })
  }

})

//==============================TELA DE LOGIN==================================

app.post('/login', async (req, res) => {

  let { login, senha } = req.body

  db.get(
    "SELECT * FROM usuarios WHERE login = ?",
    [login],
    async (err, user) => {

      if(err){
        return res.status(500).json({ erro: err.message })
      }

      if(!user){
        return res.status(401).json({ erro: "Login inválido" })
      }

      const senhaValida = await bcrypt.compare(senha, user.senha)

      if(!senhaValida){
        return res.status(401).json({ erro: "Login inválido" })
      }

      res.json({
  ok: true,
  usuario: {
    id: user.id,
    nome: user.nome,
    login: user.login,
    turma_id: user.turma_id,
    tipo: user.tipo || "user"
  }
})

    }
  )

})

//MULTI TURMAS

app.get('/turmas', (req, res) => {

  db.all("SELECT * FROM turmas", [], (err, turmas) => {

    if(err){
      console.error(err)
      return res.status(500).json(err)
    }

    res.json(turmas)
  })

})

app.get('/turmas/:id', (req, res) => {

  const id = req.params.id

  db.get(
    "SELECT * FROM turmas WHERE id = ?",
    [id],
    (err, turma) => {

      if(err){
        console.error(err)
        return res.status(500).json(err)
      }

      if(!turma){
        return res.status(404).json({ erro: "Turma não encontrada" })
      }

      res.json(turma)
    }
  )
})

app.put('/turmas/:id', (req, res) => {

  const id = req.params.id
  const { nome, valor_mensalidade } = req.body

  db.run(
    `
    UPDATE turmas 
    SET nome = COALESCE(?, nome),
        valor_mensalidade = COALESCE(?, valor_mensalidade)
    WHERE id = ?
    `,
    [nome, valor_mensalidade, id],
    function(err){

      if(err){
        console.error(err)
        return res.status(500).json(err)
      }

      console.log("✅ TURMA ATUALIZADA:", id)

      res.json({ ok: true })
    }
  )
})



// 🔥 SEMPRE POR ÚLTIMO

// 🔐 cria admin automático
criarAdminPadrao()

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("Servidor rodando na porta", PORT)
})

//app.listen(3000, () => {
  //console.log('Servidor rodando em http://localhost:3000')
//})