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
  let numeroCamisa = document.getElementById("numeroCamisa").value

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
  numero_camisa: numeroCamisa,
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

function toggleCadastroJogador(){

  let formulario = document.getElementById("formularioCadastroJogador")
  let titulo = document.getElementById("tituloCadastroJogador")

  if(!formulario || !titulo) return

  let aberto = formulario.style.display === "block"

  formulario.style.display = aberto ? "none" : "block"

  titulo.textContent = aberto
    ? "▶ Cadastrar Jogador"
    : "▼ Cadastrar Jogador"
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
  <th>Nº Camiseta</th>
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
  <tr class="jogador-linha" onclick="toggleJogador(${j.id})">
    <td colspan="10">

      <div class="jogador-resumo">
        <span>
          ${getMedalha(j.nivel)} ${j.nome || "-"}
        </span>
        <span class="jogador-seta">›</span>
      </div>

      <div id="detalhe_${j.id}" class="detalhe-jogador-desktop" style="display:none">

        <div class="jogador-info">
          <div><strong>Nº Camiseta:</strong> ${j.numero_camisa || "-"}</div>
          <div><strong>CPF:</strong> ${j.cpf || "-"}</div>
          <div><strong>Telefone:</strong> ${j.telefone || "-"}</div>
          <div><strong>Posição:</strong> ${j.posicao || "-"}</div>
          <div><strong>Nascimento:</strong> ${formatarDataBR(j.nascimento) || "-"}</div>
          <div><strong>Idade:</strong> ${idade}</div>
          <div><strong>Cadastro:</strong> ${formatarDataBR(j.dataCadastro || j.data_cadastro)}</div>
        </div>

        <div class="jogador-acoes">
          <button onclick="event.stopPropagation(); editarJogador(${j.id})">
            ✏️ Editar
          </button>

          <button onclick="event.stopPropagation(); inativarJogador(${j.id})">
            🚫 Inativar
          </button>

          <button onclick="event.stopPropagation(); excluirJogador(${j.id})">
            🗑️ Excluir
          </button>
        </div>

      </div>

    </td>
  </tr>
`

    let linhaInativo = `
  <tr class="jogador-linha" onclick="toggleJogador(${j.id})">
    <td colspan="10">

      <div class="jogador-resumo">
        <span>
          ${getMedalha(j.nivel)} ${j.nome || "-"}
        </span>
        <span class="jogador-seta">⌄</span>
      </div>

      <div id="detalhe_${j.id}" class="detalhe-jogador-desktop" style="display:none">

        <div class="jogador-info">
          <div><strong>Nº Camiseta:</strong> ${j.numero_camisa || "-"}</div>
          <div><strong>CPF:</strong> ${j.cpf || "-"}</div>
          <div><strong>Telefone:</strong> ${j.telefone || "-"}</div>
          <div><strong>Posição:</strong> ${j.posicao || "-"}</div>
          <div><strong>Nascimento:</strong> ${formatarDataBR(j.nascimento) || "-"}</div>
          <div><strong>Idade:</strong> ${idade}</div>
          <div><strong>Cadastro:</strong> ${formatarDataBR(j.dataCadastro || j.data_cadastro)}</div>
        </div>

        <div class="jogador-acoes">
          <button onclick="event.stopPropagation(); ativarJogador(${j.id})">
            ✅ Ativar
          </button>

          <button onclick="event.stopPropagation(); excluirJogador(${j.id})">
            🗑️ Excluir
          </button>
        </div>

      </div>

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
    <div class="card-jogador" onclick="toggleJogadorMobile(${j.id})">
      👤 ${getMedalha(j.nivel)} ${j.nome}
    </div>

    <div id="detalhe_mobile_${j.id}" class="detalhe-jogador" style="display:none">

      📞 ${j.telefone || "-"} <br>
      📄 ${j.cpf || "-"} <br>
      ⚽ ${j.posicao || "-"} <br>
      🎂 ${j.nascimento ? formatarDataBR(j.nascimento) : "-"} <br>
      👤 ${j.nascimento ? calcularIdade(j.nascimento) + " anos" : "-"} <br><br>

      <button onclick="editarJogadorMobile(${j.id})">✏️</button>
      <button onclick="inativarJogador(${j.id})">🚫</button>
      <button onclick="excluirJogador(${j.id})">🗑️</button>

    </div>
  `).join("")
}

function editarJogadorMobile(id){

  let jogador = jogadores.find(j => j.id == id)

  if(!jogador){

    console.error("Jogador não encontrado:", id)

    return
  }

  let detalhe = document.getElementById("detalhe_mobile_" + id)

  if(!detalhe){

    console.error("Detalhe do jogador não encontrado:", id)

    return
  }

  detalhe.style.display = "block"

  detalhe.onclick = function(event){
    event.stopPropagation()
  }

  detalhe.innerHTML = `

    <div class="edicao-jogador-mobile">

      <label>Nome</label>
      <input
        type="text"
        id="editar_mobile_nome_${id}"
        value="${jogador.nome || ""}"
      >

      <label>Telefone</label>
      <input
        type="text"
        id="editar_mobile_telefone_${id}"
        value="${jogador.telefone || ""}"
      >

      <label>CPF</label>
      <input
        type="text"
        id="editar_mobile_cpf_${id}"
        value="${jogador.cpf || ""}"
      >

      <label>E-mail</label>
      <input
        type="email"
        id="editar_mobile_email_${id}"
        value="${jogador.email || ""}"
      >

      <label>Nascimento</label>
      <input
        type="date"
        id="editar_mobile_nascimento_${id}"
        value="${jogador.nascimento ? jogador.nascimento.split("T")[0] : ""}"
      >

      <label>Posição</label>
      <select id="editar_mobile_posicao_${id}">
        <option value="">Posição</option>
        <option ${jogador.posicao === "Goleiro" ? "selected" : ""}>Goleiro</option>
        <option ${jogador.posicao === "Zagueiro" ? "selected" : ""}>Zagueiro</option>
        <option ${jogador.posicao === "Lateral" ? "selected" : ""}>Lateral</option>
        <option ${jogador.posicao === "Meia" ? "selected" : ""}>Meia</option>
        <option ${jogador.posicao === "Atacante" ? "selected" : ""}>Atacante</option>
      </select>

      <label>Nº Camiseta</label>
      <input
        type="number"
        id="editar_mobile_numeroCamisa_${id}"
        value="${jogador.numero_camisa || ""}"
        min="0"
        max="999"
      >

      <label>Nível</label>
      <select id="editar_mobile_nivel_${id}">
        <option value="ouro" ${jogador.nivel === "ouro" ? "selected" : ""}>
          🥇 Ouro
        </option>
        <option value="prata" ${jogador.nivel === "prata" ? "selected" : ""}>
          🥈 Prata
        </option>
        <option value="bronze" ${jogador.nivel === "bronze" ? "selected" : ""}>
          🥉 Bronze
        </option>
      </select>

    </div>

    <div class="jogador-acoes-mobile">

      <button
        onclick="event.stopPropagation(); salvarEdicaoJogadorMobile(${id})"
      >
        💾 Salvar
      </button>

      <button
        onclick="event.stopPropagation(); cancelarEdicaoJogadorMobile(${id})"
      >
        ✕ Cancelar
      </button>

    </div>

  `
}

async function salvarEdicaoJogadorMobile(id){

  let jogador = jogadores.find(j => j.id == id)

  if(!jogador){
    mostrarToast("Jogador não encontrado")
    return
  }

  let dados = {

    nome: document.getElementById(`editar_mobile_nome_${id}`).value,
    telefone: document.getElementById(`editar_mobile_telefone_${id}`).value,
    cpf: document.getElementById(`editar_mobile_cpf_${id}`).value,
    email: document.getElementById(`editar_mobile_email_${id}`).value,
    nascimento: document.getElementById(`editar_mobile_nascimento_${id}`).value,
    posicao: document.getElementById(`editar_mobile_posicao_${id}`).value,
    numero_camisa: document.getElementById(`editar_mobile_numeroCamisa_${id}`).value,
    nivel: document.getElementById(`editar_mobile_nivel_${id}`).value,
    status: jogador.status,
    turma_id: jogador.turma_id

  }

  if(dados.nome.trim() === ""){
    mostrarToast("Digite o nome do jogador")
    return
  }

  try {

    await apiPut(`/jogadores/${id}`, dados)

    mostrarToast("Jogador atualizado com sucesso!")

    await carregarJogadores()

  } catch(erro) {

    console.error("Erro ao atualizar jogador:", erro)

    mostrarToast(
      erro.erro || "Erro ao atualizar jogador"
    )

  }

}

function cancelarEdicaoJogadorMobile(id){

  let detalhe = document.getElementById("detalhe_mobile_" + id)

  if(detalhe){

    detalhe.style.display = "none"
    detalhe.onclick = null

  }

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
    <div class="card-jogador" onclick="toggleJogadorMobile(${j.id})">
      👤 ${getMedalha(j.nivel)} ${j.nome}
    </div>

    <div id="detalhe_mobile_${j.id}" class="detalhe-jogador" style="display:none">

      📞 ${j.telefone || "-"} <br>
      📄 ${j.cpf || "-"} <br>
      ⚽ ${j.posicao || "-"} <br>
      🎂 ${j.nascimento ? formatarDataBR(j.nascimento) : "-"} <br>
      👤 ${j.nascimento ? calcularIdade(j.nascimento) + " anos" : "-"} <br><br>

      <button onclick="editarJogadorMobile(${j.id})">✏️</button>
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

  let jogador = jogadores.find(j => j.id == id)

  if(!jogador){

    console.error("Jogador não encontrado:", id)

    return
  }

  let detalhe = document.getElementById("detalhe_" + id)

  if(!detalhe){

    console.error("Área de edição do jogador não encontrada:", id)

    return
  }

  detalhe.style.display = "block"
  detalhe.onclick = function(event){
  event.stopPropagation()
}

  detalhe.innerHTML = `

    <div class="edicao-jogador">

      <div class="campo-edicao">
        <label>Nome</label>
        <input
          type="text"
          id="editar_nome_${id}"
          value="${jogador.nome || ""}"
        >
      </div>

      <div class="campo-edicao">
        <label>Telefone</label>
        <input
          type="text"
          id="editar_telefone_${id}"
          value="${jogador.telefone || ""}"
        >
      </div>

      <div class="campo-edicao">
        <label>CPF</label>
        <input
          type="text"
          id="editar_cpf_${id}"
          value="${jogador.cpf || ""}"
        >
      </div>

      <div class="campo-edicao">
        <label>E-mail</label>
        <input
          type="email"
          id="editar_email_${id}"
          value="${jogador.email || ""}"
        >
      </div>

      <div class="campo-edicao">
        <label>Nascimento</label>
        <input
          type="date"
          id="editar_nascimento_${id}"
          value="${jogador.nascimento ? jogador.nascimento.split("T")[0] : ""}"
        >
      </div>

      <div class="campo-edicao">
        <label>Posição</label>
        <select id="editar_posicao_${id}">
          <option value="">Posição</option>
          <option ${jogador.posicao === "Goleiro" ? "selected" : ""}>Goleiro</option>
          <option ${jogador.posicao === "Zagueiro" ? "selected" : ""}>Zagueiro</option>
          <option ${jogador.posicao === "Lateral" ? "selected" : ""}>Lateral</option>
          <option ${jogador.posicao === "Meia" ? "selected" : ""}>Meia</option>
          <option ${jogador.posicao === "Atacante" ? "selected" : ""}>Atacante</option>
        </select>
      </div>

      <div class="campo-edicao">
        <label>Nº Camiseta</label>
        <input
          type="number"
          id="editar_numeroCamisa_${id}"
          value="${jogador.numero_camisa || ""}"
          min="0"
          max="999"
        >
      </div>

      <div class="campo-edicao">
        <label>Nível</label>
        <select id="editar_nivel_${id}">

          <option value="ouro" ${jogador.nivel === "ouro" ? "selected" : ""}>
            🥇 Ouro
          </option>

          <option value="prata" ${jogador.nivel === "prata" ? "selected" : ""}>
            🥈 Prata
          </option>

          <option value="bronze" ${jogador.nivel === "bronze" ? "selected" : ""}>
            🥉 Bronze
          </option>

        </select>
      </div>

    </div>

    <div class="jogador-acoes">

      <button
        onclick="event.stopPropagation(); salvarEdicaoJogador(${id})"
      >
        💾 Salvar alterações
      </button>

      <button
        onclick="event.stopPropagation(); cancelarEdicaoJogador(${id})"
      >
        ✕ Cancelar
      </button>

    </div>

  `
}

async function salvarEdicaoJogador(id){

  let jogador = jogadores.find(j => j.id == id)

  if(!jogador){
    mostrarToast("Jogador não encontrado")
    return
  }

  let dados = {

    nome: document.getElementById(`editar_nome_${id}`).value,
    telefone: document.getElementById(`editar_telefone_${id}`).value,
    cpf: document.getElementById(`editar_cpf_${id}`).value,
    email: document.getElementById(`editar_email_${id}`).value,
    nascimento: document.getElementById(`editar_nascimento_${id}`).value,
    posicao: document.getElementById(`editar_posicao_${id}`).value,
    numero_camisa: document.getElementById(`editar_numeroCamisa_${id}`).value,
    nivel: document.getElementById(`editar_nivel_${id}`).value,
    status: jogador.status,
    turma_id: jogador.turma_id

  }

  if(dados.nome.trim() === ""){
    mostrarToast("Digite o nome do jogador")
    return
  }

  try {

    await apiPut(`/jogadores/${id}`, dados)

    mostrarToast("Jogador atualizado com sucesso!")

    await carregarJogadores()

  } catch(erro) {

    console.error("Erro ao atualizar jogador:", erro)

    mostrarToast(
      erro.erro || "Erro ao atualizar jogador"
    )

  }

}

function cancelarEdicaoJogador(id){

  let jogador = jogadores.find(j => j.id == id)

  if(!jogador) return

  // Fecha a edição
  let detalhe = document.getElementById("detalhe_" + id)

  if(detalhe){
    detalhe.style.display = "none"
    detalhe.onclick = null
  }
}

function criarCardJogador(j){

  return `
  <div class="card-jogador">

    <div class="card-header" onclick="toggleDetalhe(${j.id})">

      <div class="jogador-nome">
        ${getMedalha(j.nivel)}
        <span>${j.nome || "-"}</span>
      </div>

      <div class="jogador-seta" id="seta_${j.id}">
        ▾
      </div>

    </div>

    <div id="detalhe_${j.id}" class="card-detalhe" style="display:none">

      <div class="dados-jogador">

        <div class="dado-jogador">
          <span>CPF</span>
          <strong>${j.cpf || "-"}</strong>
        </div>

        <div class="dado-jogador">
          <span>Telefone</span>
          <strong>${j.telefone || "-"}</strong>
        </div>

        <div class="dado-jogador">
          <span>Posição</span>
          <strong>${j.posicao || "-"}</strong>
        </div>

        <div class="dado-jogador">
          <span>Nº Camiseta</span>
          <strong>${j.numero_camisa || "-"}</strong>
        </div>

        <div class="dado-jogador">
          <span>Nascimento</span>
          <strong>${formatarDataBR(j.nascimento) || "-"}</strong>
        </div>

        <div class="dado-jogador">
          <span>Idade</span>
          <strong>${j.nascimento ? calcularIdade(j.nascimento) + " anos" : "-"}</strong>
        </div>

        <div class="dado-jogador">
          <span>Cadastro</span>
          <strong>${formatarDataBR(j.dataCadastro || j.data_cadastro) || "-"}</strong>
        </div>

      </div>

      <div class="acoes">

        <button onclick="editarJogador(${j.id})">
          ✏️ Editar
        </button>

        <button onclick="inativarJogador(${j.id})">
          🚫 Inativar
        </button>

        <button onclick="excluirJogador(${j.id})">
          🗑️ Excluir
        </button>

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

  let seta = el.closest("tr")?.querySelector(".jogador-seta")

  if(seta){
    seta.textContent = aberto ? "›" : "⌄"
  }
}

function getMedalha(nivel){
  if(nivel === "ouro") return "🥇"
  if(nivel === "prata") return "🥈"
  if(nivel === "bronze") return "🥉"
  return ""
}

function toggleJogadorMobile(id){

  let el = document.getElementById("detalhe_mobile_" + id)

  if(!el) return

  let aberto = el.style.display === "block"

  el.style.display = aberto ? "none" : "block"
}

