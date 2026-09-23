//JOGADORES//
let jogadores = []
let idEditando = null
//let jogadorEditando = null

// Cadastro de Jogadores: //

async function cadastrar(){

  console.log("Clicou em cadastrar")
  console.log("ID EDITANDO:", idEditando)
  console.log("URL:", "http://localhost:3000/jogadores/" + idEditando)

  let nome=document.getElementById("nome").value
  let telefone=document.getElementById("telefone").value
  let cpf=document.getElementById("cpf").value
  let email=document.getElementById("email").value
  let nascimento=document.getElementById("nascimento").value
  let posicao=document.getElementById("posicao").value
  let nivel = document.getElementById("nivel").value

  if(nome===""){
    mostrarToast("Digite o nome do jogador")
    return
  }

  let hoje = new Date()

  let dataCadastro =
  hoje.getDate().toString().padStart(2,"0") + "/" +
  (hoje.getMonth()+1).toString().padStart(2,"0") + "/" +
  hoje.getFullYear()

  let jogador={
    nome:nome,
    telefone:telefone,
    cpf:cpf,
    email:email,
    nascimento:nascimento,
    posicao:posicao,
    nivel:nivel,
    dataCadastro:dataCadastro,
    status:"ativo"
  }

  let turmaSelecionada = JSON.parse(
  localStorage.getItem("turmaSelecionada")
)

if(!turmaSelecionada){
  mostrarToast("Selecione uma turma primeiro")
  return
}

let turmaId = Number(turmaSelecionada.turma_id)

jogador.turma_id = turmaId

  // 🔥 EDITAR
  if(idEditando !== null){

    try {

  await apiPut(`/jogadores/${idEditando}`, jogador)

  mostrarToast("Jogador atualizado com sucesso!")

  idEditando = null

} catch (erro) {

  console.error("Erro:", erro)
  mostrarToast(erro.erro || "Erro ao atualizar jogador")
  return
}

 } else {

  let cpfLimpo = cpf.replace(/\D/g, "")

  let existeCpf = jogadores.find(j => 
    j.cpf?.replace(/\D/g, "") === cpfLimpo &&
    j.turma_id === turmaId &&
    j.id != idEditando
  )

  if(existeCpf){
    mostrarToast("Já existe um jogador com esse CPF")
    return
  }

  try {

    await apiPost('/jogadores', jogador)

    mostrarToast("Jogador cadastrado com sucesso!")

  } catch (erro) {

    console.error("Erro:", erro)
    mostrarToast(erro.erro || "Erro ao cadastrar jogador")
    return
  }

}


  // 🔥 RECARREGA
  await carregarJogadores()

  // 🔥 LIMPA CAMPOS
  document.getElementById("nome").value=""
  document.getElementById("telefone").value=""
  document.getElementById("cpf").value=""
  document.getElementById("nascimento").value=""
  document.getElementById("posicao").value=""

  atualizarSelectJogadores()
  atualizarPainel()
  mostrarAniversarios()
}

// Mostrar Lista de Jogadores na Tabela: //

async function carregarJogadores(){

  let turmaSelecionada = JSON.parse(
  localStorage.getItem("turmaSelecionada")
)

if(!turmaSelecionada){
  console.warn("Nenhuma turma selecionada")
  return
}

let turmaId = Number(turmaSelecionada.turma_id)

  jogadores = await apiGet(`/jogadores/${turmaId}`)

  console.log("Jogadores carregados:", jogadores)
  renderJogadores()
  mostrarJogadores()
  atualizarSelectJogadores()
  atualizarPainel()
  mostrarAniversarios()
}

async function salvarJogadorBackend(jogador){

  try {

    let url = "/jogadores"
    let metodo = "POST"

    if(idEditando !== null){
      url = `/jogadores/${idEditando}`
      metodo = "PUT"
    }

    console.log("Enviando pro backend:", jogador)

    let res

    if(metodo === "POST"){
      res = await apiPost(url, jogador)
    } else {
      res = await apiPut(url, jogador)
    }

    // 🔴 TRATAR ERRO DO BACKEND
    if(res?.erro){
      mostrarToast(res.erro)
      return
    }

    // 🔥 DEFINE MENSAGEM ANTES DE RESETAR
    let mensagem = idEditando !== null 
      ? "Jogador atualizado com sucesso!" 
      : "Jogador cadastrado com sucesso!"

    // 🔥 RESETA CONTROLE
    idEditando = null

    // 🔥 LIMPA FORMULÁRIO (SE EXISTIR)
    if(typeof limparFormulario === "function"){
      limparFormulario()
    }

    // 🔥 ATUALIZA LISTA (AGUARDANDO)
    await carregarJogadores()

    // 🔥 MOSTRA MENSAGEM POR ÚLTIMO
    mostrarToast(mensagem)

  } catch(e){
    console.error("Erro ao salvar jogador:", e)
    mostrarToast("Erro ao salvar jogador")
  }

}

function mostrarJogadores(){

  console.log("lista:", document.getElementById("listaJogadores"))

  let lista = document.getElementById("listaJogadores")
  let listaInativos = document.getElementById("listaInativos")

  if(!lista){
    console.error("Tabela de jogadores não encontrada")
    return
  }

  let turmaSelecionada = JSON.parse(
    localStorage.getItem("turmaSelecionada")
  )

  // =========================
  // 👤 JOGADOR
  // =========================

 if(turmaSelecionada?.perfil === "JOGADOR"){

    // Ajusta o cabeçalho da tabela para o jogador
    let tabela = document.getElementById("tabelaJogadores")

    if(tabela){

      let cabecalho = tabela.querySelector("thead")

      if(cabecalho){
        cabecalho.innerHTML = `
          <tr>
            <th>N°</th>
            <th>Nome</th>
            <th>Posição</th>
          </tr>
        `
      }

    }

    lista.innerHTML = ""

    if(listaInativos){
      listaInativos.innerHTML = ""
    }

    jogadores.sort((a, b) =>
      (a.nome || "").localeCompare(b.nome || "")
    )

    jogadores.forEach((j, i) => {

      lista.innerHTML += `
        <tr>
          <td>${i + 1}</td>
          <td>${j.nome || "-"}</td>
          <td>${j.posicao || "-"}</td>
        </tr>
      `

    })

    return
}

  // =========================
  // 👑 ADMIN
  // =========================
let tabela = document.getElementById("tabelaJogadores")

if(tabela){

  let cabecalho = tabela.querySelector("thead")

  if(cabecalho){
    cabecalho.innerHTML = `
      <tr>
        <th>N°</th>
        <th>Nome</th>
        <th>CPF</th>
        <th>Telefone</th>
        <th>Posição</th>
        <th>Nascimento</th>
        <th>Idade</th>
        <th>Cadastro</th>
        <th>Ações</th>
      </tr>
    `
  }

}
  if(!listaInativos){
    console.error("Tabela de jogadores inativos não encontrada")
    return
  }

  jogadores.sort((a, b) =>
    (a.nome || "").localeCompare(b.nome || "")
  )

  lista.innerHTML = ""
  listaInativos.innerHTML = ""

  for(let i = 0; i < jogadores.length; i++){

    let j = jogadores[i]

    let idade = j.nascimento
      ? calcularIdade(j.nascimento)
      : "-"

    let status = j.status || "ativo"

    let numero = i + 1

    let linhaAtivo = `
      <tr>
        <td>${numero}</td>
        <td>${getMedalha(j.nivel)} ${j.nome || "-"}</td>
        <td>${j.cpf || "-"}</td>
        <td>${j.telefone || "-"}</td>
        <td>${j.posicao || "-"}</td>
        <td>${formatarDataBR(j.nascimento) || "-"}</td>
        <td>${idade}</td>
        <td>${formatarDataBR(j.dataCadastro || j.data_cadastro)}</td>
        <td>
          <button onclick="editarJogador(${j.id})">✏️ Editar</button>
          <button onclick="inativarJogador(${j.id})">🚫 Inativar</button>
          <button onclick="excluirJogador(${j.id})">🗑️ Excluir</button>
        </td>
      </tr>
    `

    let linhaInativo = `
      <tr>
        <td>${numero}</td>
        <td>${getMedalha(j.nivel)} ${j.nome || "-"}</td>
        <td>${j.cpf || "-"}</td>
        <td>${j.telefone || "-"}</td>
        <td>${j.posicao || "-"}</td>
        <td>${formatarDataBR(j.nascimento) || "-"}</td>
        <td>${idade}</td>
        <td>${formatarDataBR(j.dataCadastro || j.data_cadastro)}</td>
        <td>
          <button onclick="ativarJogador(${j.id})">✅ Ativar</button>
          <button onclick="excluirJogador(${j.id})">🗑️ Excluir</button>
        </td>
      </tr>
    `

    if(status === "ativo"){
      lista.innerHTML += linhaAtivo
    }else{
      listaInativos.innerHTML += linhaInativo
    }

  }

}

function mostrarJogadoresMobile(){

  let container = document.getElementById("listaJogadoresMobile")
  if(!container) return

  let turmaSelecionada = JSON.parse(
    localStorage.getItem("turmaSelecionada")
  )

  let ativos = jogadores.filter(j => j.status === "ativo")

  // =========================
  // 👤 JOGADOR
  // =========================

  if(turmaSelecionada?.perfil === "JOGADOR"){

    container.innerHTML = ativos.map(j => `
      <div class="card-jogador">

        👤 ${j.nome}

        <div>
          ⚽ ${j.posicao || "-"} <br>
          📞 ${j.telefone || "-"} <br>
          🎂 ${j.nascimento ? formatarDataBR(j.nascimento) : "-"}
        </div>

      </div>
    `).join("")

    return
  }

  // =========================
  // 👑 ADMIN
  // =========================

  container.innerHTML = ativos.map(j => `
    <div class="card-jogador" onclick="toggleJogador(${j.id})">
      👤 ${getMedalha(j.nivel)} ${j.nome}
    </div>

    <div id="detalhe_${j.id}" class="detalhe-jogador" style="display:none">

      📞 ${j.telefone || "-"} <br>
      📄 ${j.cpf || "-"} <br>
      ⚽ ${j.posicao || "-"} <br>
      🎂 ${j.nascimento ? formatarDataBR(j.nascimento) : "-"} <br>
      👤 ${j.nascimento ? calcularIdade(j.nascimento) + " anos" : "-"} <br><br>

      <button onclick="editarJogador(${j.id})">✏️</button>
      <button onclick="inativarJogador(${j.id})">🚫</button>
      <button onclick="excluirJogador(${j.id})">🗑️</button>

    </div>
  `).join("")
}
  
function mostrarJogadoresInativosMobile(){

  let container = document.getElementById("listaJogadoresInativosMobile")
  if(!container) return

  let turmaSelecionada = JSON.parse(
    localStorage.getItem("turmaSelecionada")
  )

  let inativos = jogadores.filter(j => j.status !== "ativo")

  // =========================
  // 👤 JOGADOR
  // =========================

  if(turmaSelecionada?.perfil === "JOGADOR"){

    container.innerHTML = inativos.map(j => `
      <div class="card-jogador">

        👤 ${j.nome}

        <div>
          ⚽ ${j.posicao || "-"} <br>
          📞 ${j.telefone || "-"} <br>
          🎂 ${j.nascimento ? formatarDataBR(j.nascimento) : "-"}
        </div>

      </div>
    `).join("")

    return
  }

  // =========================
  // 👑 ADMIN
  // =========================

  container.innerHTML = inativos.map(j => `
    <div class="card-jogador" onclick="toggleJogador(${j.id})">
      👤 ${getMedalha(j.nivel)} ${j.nome}
    </div>

    <div id="detalhe_${j.id}" class="detalhe-jogador" style="display:none">

      📞 ${j.telefone || "-"} <br>
      📄 ${j.cpf || "-"} <br>
      ⚽ ${j.posicao || "-"} <br>
      🎂 ${j.nascimento ? formatarDataBR(j.nascimento) : "-"} <br>
      👤 ${j.nascimento ? calcularIdade(j.nascimento) + " anos" : "-"} <br><br>

      <button onclick="ativarJogador(${j.id})">✅</button>
      <button onclick="excluirJogador(${j.id})">🗑️</button>

    </div>
  `).join("")
}

function atualizarSelectJogadores(){

  let selectPagamento = document.getElementById("jogadorPagamento")
  let selectUsuario = document.getElementById("jogadorUsuario")

  // =========================
  // SELECT DE PAGAMENTOS
  // =========================

  if(selectPagamento){

    selectPagamento.innerHTML = ""

    for(let i = 0; i < jogadores.length; i++){

      if(jogadores[i].status === "ativo"){

        let option = document.createElement("option")

        option.value = jogadores[i].id
        option.text = jogadores[i].nome

        selectPagamento.appendChild(option)

      }

    }

  }

  // =========================
  // SELECT DE USUÁRIOS
  // =========================

  if(selectUsuario){

    selectUsuario.innerHTML = ""

    let opcaoInicial = document.createElement("option")
    opcaoInicial.value = ""
    opcaoInicial.text = "Selecione o jogador"

    selectUsuario.appendChild(opcaoInicial)

    for(let i = 0; i < jogadores.length; i++){

      if(jogadores[i].status === "ativo"){

        let option = document.createElement("option")

        option.value = jogadores[i].id
        option.text = jogadores[i].nome

        selectUsuario.appendChild(option)

      }

    }

  }

}

// ATIVAR INATIVAR JOGADOR //

async function inativarJogador(id){

  console.log("ID RECEBIDO:", id)

  if(!id){
    mostrarToast("Erro: ID inválido")
    return
  }

  try {

    await apiPut(`/jogadores/${id}`, {
      status: "inativo"
    })

    mostrarToast("Jogador inativado!")
    await carregarJogadores()

  } catch(e){
    console.error("Erro:", e)
    mostrarToast("Erro ao inativar jogador")
  }
}

async function ativarJogador(id){

  await apiPut(`/jogadores/${id}`, {
    status: "ativo"
  })

  await carregarJogadores()
}

async function excluirJogador(id){

  if(!confirm("Deseja excluir esse jogador?")) return

  await apiDelete(`/jogadores/${id}`)

  mostrarToast("Jogador excluído com sucesso")

  await carregarJogadores()
}

function editarJogador(id){

  idEditando = id

  let jogador = jogadores.find(j => j.id == id)

  if(!jogador){

    console.error("Jogador não encontrado:", id)

    return
  }

  document.getElementById("nome").value = jogador.nome || ""
  document.getElementById("telefone").value = jogador.telefone || ""
  document.getElementById("cpf").value = jogador.cpf || ""
  document.getElementById("email").value = jogador.email || ""
  document.getElementById("nascimento").value = jogador.nascimento
    ? jogador.nascimento.split("T")[0]
    : ""
  document.getElementById("posicao").value = jogador.posicao || ""
}

function criarCardJogador(j){

  return `
  <div class="card-jogador">

    <div class="card-header" onclick="toggleDetalhe(${j.id})">
      👤 ${getMedalha(j.nivel)} ${j.nome}
    </div>

    <div id="detalhe_${j.id}" class="card-detalhe" style="display:none">

      <p>📄 CPF: ${j.cpf}</p>
      <p>📞 Tel: ${j.telefone}</p>
      <p>⚽ ${j.posicao}</p>
      <p>🎂 ${formatarDataBR(j.nascimento)}</p>
      <p>📅 Cadastro: ${formatarDataBR(j.dataCadastro)}</p>

      <div class="acoes">
        <button onclick="editar(${j.id})">✏️</button>
        <button onclick="inativar(${j.id})">🚫</button>
        <button onclick="excluir(${j.id})">🗑️</button>
      </div>

    </div>

  </div>
  `
  
}

function renderJogadores(){

  let mobile = window.matchMedia("(max-width: 768px)").matches

  if(mobile){

    // ATIVOS
    document.getElementById("tabelaJogadores").style.display = "none"
    document.getElementById("listaJogadoresMobile").style.display = "block"
    mostrarJogadoresMobile()

    // INATIVOS
    document.getElementById("tabelaJogadoresInativos").style.display = "none"
    document.getElementById("listaJogadoresInativosMobile").style.display = "block"
    mostrarJogadoresInativosMobile()

  } else {

    document.getElementById("tabelaJogadores").style.display = "table"
    document.getElementById("listaJogadoresMobile").style.display = "none"

    document.getElementById("tabelaJogadoresInativos").style.display = "table"
    document.getElementById("listaJogadoresInativosMobile").style.display = "none"

    mostrarJogadores()
  }
}

function toggleJogador(id){

  let el = document.getElementById("detalhe_" + id)

  if(!el) return

  let aberto = el.style.display === "block"

  el.style.display = aberto ? "none" : "block"
}

function getMedalha(nivel){
  if(nivel === "ouro") return "🥇"
  if(nivel === "prata") return "🥈"
  if(nivel === "bronze") return "🥉"
  return ""
}