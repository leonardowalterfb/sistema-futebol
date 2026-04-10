let presencas = []
let historicoJogos = []
let ranking = {}
let jogoAberto = false

//CRIAR JOGO//

function criarJogo(){

let data = document.getElementById("dataJogo").value
let local = document.getElementById("localJogo").value

if(data === "" || local === ""){
  mostrarToast("Informe a data e o local antes de criar o jogo.")
  return
}

// 🔥 VALIDAR DATA (não permitir passado)
//let dataSelecionada = new Date(data)

//let hoje = new Date()
//hoje.setHours(0,0,0,0)

//if(dataSelecionada < hoje){
//  mostrarToast("Não é permitido criar jogo com data anterior a hoje")
//  return
//}

if(jogoAberto){
  mostrarToast("Já existe um jogo aberto.")
  return
}

// 🔥 RESET CORRETO
presencas = []

for(let i=0;i<jogadores.length;i++){
  if(jogadores[i].status === "ativo"){
    presencas.push({
      nome: jogadores[i].nome,
      confirmado: false,
      respondido: false
    })
  }
}

jogoAberto = true

salvarJogo()

mostrarPresenca()
}

function mostrarPresenca(){

let totalJogadores = presencas.length
let totalConfirmados = 0
let totalNaoConfirmados = 0

let lista = document.getElementById("listaPresenca")
let confirmados = document.getElementById("confirmados")
let naoConfirmados = document.getElementById("naoConfirmados")

lista.innerHTML=""
confirmados.innerHTML=""
naoConfirmados.innerHTML=""

// 🔥 CORREÇÃO AQUI (ANTES DO LOOP)
if(presencas.length === 0){

  lista.innerHTML =
    "<tr><td colspan='2'>Nenhum jogo criado ainda</td></tr>"

  return
}

for(let i=0;i<presencas.length;i++){

  if(presencas[i].confirmado === true){

    totalConfirmados++

    confirmados.innerHTML +=
    "<tr>"+
    "<td style='padding:6px'>"+presencas[i].nome+"</td>"+
    "<td><button onclick='voltarLista("+i+")'>↩ Voltar</button></td>"+
    "</tr>"

  }

  else if(presencas[i].respondido === true){

    totalNaoConfirmados++

    naoConfirmados.innerHTML +=
    "<tr>"+
    "<td style='padding:6px'>"+presencas[i].nome+"</td>"+
    "<td><button onclick='voltarLista("+i+")'>↩ Voltar</button></td>"+
    "</tr>"

  }

  else{

    lista.innerHTML += `
    <tr>
      <td style="padding:6px">${presencas[i].nome}</td>
      <td>
        <button onclick="confirmar(${i})">✅ Confirmar</button>
        <button onclick="faltar(${i})">❌ Faltar</button>
      </td>
    </tr>
    `
  }

}

document.getElementById("tituloJogadores").innerText =
"Jogadores (" + totalJogadores + ")"

document.getElementById("tituloConfirmados").innerText =
"Confirmados (" + totalConfirmados + ")"

document.getElementById("tituloNaoConfirmados").innerText =
"Não Confirmados (" + totalNaoConfirmados + ")"

}

function confirmar(index){

if(!jogoAberto){
mostrarToast("Crie um jogo antes de registrar presença.")
return
}

presencas[index].confirmado = true
presencas[index].respondido = true

salvarJogo()
mostrarPresenca()

}

function faltar(index){

  console.log("clicou faltar", index) // 👈 TESTE

  presencas[index].confirmado = false
  presencas[index].respondido = true

  salvarJogo()

  mostrarPresenca()
}

function voltarLista(index){

  presencas[index].confirmado = false
  presencas[index].respondido = false

  salvarJogo()

  mostrarPresenca()
}

function salvarJogo(){

  localStorage.setItem("jogoAtual", JSON.stringify({
    data: document.getElementById("dataJogo").value,
    local: document.getElementById("localJogo").value,
    presencas: presencas,
    jogoAberto: jogoAberto
  }))
}

function carregarJogoSalvo(){

let jogo = localStorage.getItem("jogoAtual")

if(!jogo) return

let dados = JSON.parse(jogo)

presencas = dados.presencas || []
jogoAberto = dados.jogoAberto || false

document.getElementById("dataJogo").value = dados.data || ""
document.getElementById("localJogo").value = dados.local || ""

mostrarPresenca()
}

//HISTORICO//

async function salvarHistorico(){

let data = document.getElementById("dataJogo").value
let local = document.getElementById("localJogo").value

if(data === "" || local === ""){
  mostrarToast("Informe a data e o local do jogo")
  return
}

if(presencas.length === 0){
  mostrarToast("Crie um jogo antes de salvar")
  return
}

// separar presentes e faltaram
let presentes = []
let faltaram = []

for(let i=0;i<presencas.length;i++){
  if(presencas[i].confirmado){
    presentes.push(presencas[i].nome)
  }else{
    faltaram.push(presencas[i].nome)
  }
}

// 🔥 ATUALIZAR RANKING
// 🔥 ATUALIZAR RANKING
for(let i=0;i<presentes.length;i++){

  let nome = presentes[i]

  if(!ranking[nome]){
    ranking[nome] = 0
  }

  ranking[nome]++
}

// 🔥 SALVAR NO LOCALSTORAGE
//localStorage.setItem("ranking", JSON.stringify(ranking))

// objeto do jogo
let usuario = JSON.parse(localStorage.getItem("usuarioLogado"))
let turmaId = usuario.turma_id

let jogo = {
  data: data,
  local: local,
  presentes: presentes,
  faltaram: faltaram,
  turma_id: turmaId
}

//SALVAR NO BACKEND

await apiPost("/jogos", jogo)

mostrarToast("Jogo Salvo!")

await carregarHistorico()
await carregarRanking()

// limpar estado corretamente
presencas = []
jogoAberto = false

// limpar interface
document.getElementById("listaPresenca").innerHTML = ""
document.getElementById("confirmados").innerHTML = ""
document.getElementById("naoConfirmados").innerHTML = ""

document.getElementById("dataJogo").value = ""
document.getElementById("localJogo").value = ""

// 🔥 ATUALIZA TELA
mostrarPresenca()

}

async function carregarHistorico(){

  let usuario = JSON.parse(localStorage.getItem("usuarioLogado"))
  let turmaId = usuario.turma_id

  historicoJogos = await apiGet(`/jogos/${turmaId}`)

  mostrarHistorico()
}

function mostrarHistorico(){

  let lista = document.getElementById("historicoJogos")

  lista.innerHTML = ""

  for(let i=historicoJogos.length - 1; i >= 0; i--){

    let jogo = historicoJogos[i]

    let dataFormatada = formatarDataBR(jogo.data)

    lista.innerHTML += `
  <div class="historico-card">

    <div class="historico-header" onclick="toggleJogo(${i})" style="cursor:pointer;">
      <strong>📅 ${dataFormatada}</strong>
      <span>📍 ${jogo.local}</span>
      <button onclick="event.stopPropagation(); removerJogo(${jogo.id})">🗑️</button>
    </div>

    <div class="historico-body" id="jogo-${i}" style="display:none;">

          <div class="historico-col">
            <h4>✅ Presentes (${jogo.presentes.length})</h4>
            <ul>
              ${jogo.presentes.map(p => `<li>${p}</li>`).join("")}
            </ul>
          </div>

          <div class="historico-col">
            <h4>❌ Faltaram (${jogo.faltaram.length})</h4>
            <ul>
              ${jogo.faltaram.map(f => `<li>${f}</li>`).join("")}
            </ul>
          </div>

        </div>

      </div>
    `
  }
}

async function removerJogo(id){

  console.log("CLICOU REMOVER:", id)

  if(!id){
    mostrarToast("ID inválido")
    return
  }

  await apiDelete(`/jogos/${id}`)

  await carregarHistorico()

}

//RANKING//

async function carregarRanking(){

  let usuario = JSON.parse(localStorage.getItem("usuarioLogado"))
  let turmaId = usuario.turma_id

  let dados = await apiGet(`/ranking/${turmaId}`)

  ranking = {}

  for(let i = 0; i < dados.length; i++){
    ranking[dados[i].nome] = dados[i].presencas
  }

  mostrarRanking()
}

function mostrarRanking(){

  let lista = document.getElementById("rankingPresenca")

  if(!lista) return

  lista.innerHTML = ""

  // 🔥 USA O RANKING GLOBAL (DO BACKEND)
  let rankingArray = []

  for(let nome in ranking){
    rankingArray.push({
      nome: nome,
      presencas: ranking[nome]
    })
  }

  rankingArray.sort((a,b) => b.presencas - a.presencas)

  for(let i=0;i<rankingArray.length;i++){

    let posicao = i + 1

    let medalha = ""
    if(posicao === 1) medalha = "🥇"
    else if(posicao === 2) medalha = "🥈"
    else if(posicao === 3) medalha = "🥉"

    lista.innerHTML += `
      <li class="ranking-item">
        <div class="ranking-left">
          <span class="ranking-pos">${medalha} ${posicao}º</span>
          <span class="ranking-nome">${rankingArray[i].nome}</span>
        </div>

        <div class="ranking-right">
          <span class="ranking-pontos">${rankingArray[i].presencas} jogos</span>
          <button onclick='removerRanking("${rankingArray[i].nome}")'>🗑️</button>
        </div>
      </li>
    `
  }

}


async function removerRanking(nome){

  if(!confirm("Deseja remover esse jogador do ranking?")) return

  console.log("🗑️ REMOVENDO:", nome)

  await apiDelete(`/ranking/${encodeURIComponent(nome)}`)

  // 🔥 ATUALIZA DO BANCO
  await carregarRanking()

}

//SORTEAR JOGO//

function sortearTimes(){

let confirmados = []

for(let i=0;i<presencas.length;i++){

if(presencas[i].confirmado){

let jogador = jogadores.find(j => j.nome === presencas[i].nome)
if(jogador && !confirmados.includes(jogador)){
  confirmados.push(jogador)
}

}

}

if(confirmados.length < 2){
mostrarToast("É necessário pelo menos 2 jogadores confirmados.")
return
}

let goleiros = confirmados.filter(j => j.posicao === "Goleiro")
let linha = confirmados.filter(j => j.posicao !== "Goleiro")

let timeA = []
let timeB = []

// Garantir goleiro em cada time
if(goleiros.length >= 2){

timeA.push(goleiros[0])
timeB.push(goleiros[1])

goleiros.splice(0,2)

}

// embaralhar restante
linha = embaralhar(linha)

let todos = linha.concat(goleiros)

for(let i=0;i<todos.length;i++){

if(i % 2 === 0){
timeA.push(todos[i])
}else{
timeB.push(todos[i])
}

}

// mostrar times
let listaA = document.getElementById("timeA")
let listaB = document.getElementById("timeB")

listaA.innerHTML=""
listaB.innerHTML=""

for(let i=0;i<timeA.length;i++){
listaA.innerHTML += "<li>"+timeA[i].nome+" ("+timeA[i].posicao+")</li>"
}

for(let i=0;i<timeB.length;i++){
listaB.innerHTML += "<li>"+timeB[i].nome+" ("+timeB[i].posicao+")</li>"
}

}

function limparSorteio(){

document.getElementById("timeA").innerHTML=""
document.getElementById("timeB").innerHTML=""

}

async function mostrarSecao(secao){

  // esconde todas
  document.querySelectorAll(".secao").forEach(s => {
    s.style.display = "none"
  })

  // mostra a correta
  let ativa = document.getElementById(secao)

  if(ativa){
    ativa.style.display = "block"
  }

  // 🔥 CORREÇÃO AQUI
  if(secao === "jogos"){
    await carregarJogadores()
    mostrarPresenca()
    carregarJogoSalvo()
  }
}

function embaralhar(lista){

for(let i = lista.length - 1; i > 0; i--){

let j = Math.floor(Math.random() * (i + 1))

let temp = lista[i]
lista[i] = lista[j]
lista[j] = temp

}

return lista

}

function toggleJogo(index){

  let el = document.getElementById("jogo-" + index)

  if(el.style.display === "none"){
    el.style.display = "block"
  } else {
    el.style.display = "none"
  }
}
