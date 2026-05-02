let pagamentos = []
let despesas = []
let receitas = []

function normalizarMes(mes){
  return mes
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

//PAGAMENTOS//

async function registrarPagamento(){

  console.log("Clicou em registrar pagamento")

  let jogadorId = Number(document.getElementById("jogadorPagamento").value)
  if (!jogadorId || isNaN(jogadorId)) {
  console.error("ID inválido:", jogadorId)
  mostrarToast("Erro ao selecionar jogador")
  return
}
  let jogador = jogadores.find(j => j.id == jogadorId)
  let mes=document.getElementById("mesPagamento").value

  let pagamentoExistente = pagamentos.find(p =>
    p.jogador_id == jogadorId && p.mes === mes
  )

  if(pagamentoExistente){
    mostrarToast("Esse jogador já pagou esse mês!")
    return
  }

  let hoje = new Date()

  let dataPagamento = new Date().toISOString()

 let usuario = JSON.parse(localStorage.getItem("usuarioLogado"))
let turmaId = usuario.turma_id

console.log(jogador)

let pagamento = {
  jogador: jogador.nome,
  jogador_id: jogador.id, // 🔥 AQUI
  mes: mes,
  valor: parseFloat(getMensalidade()),
  data: dataPagamento,
  turma_id: turmaId
}

  //  SALVA NO BACKEND
  await apiPost("/pagamentos", pagamento)

  //  ATUALIZA DO BACKEND (ESSENCIAL)
  await carregarPagamentos()
  mostrarInadimplentes()
  mostrarReceitaPorMes()

}

async function carregarPagamentos(){

  let usuario = JSON.parse(localStorage.getItem("usuarioLogado"))
  let turmaId = usuario.turma_id

  pagamentos = await apiGet(`/pagamentos/${turmaId}`)

  console.log("Pagamentos carregados:", pagamentos)

  //mostrarPagamentos()
  renderPagamentos()
  atualizarPainel()

  // 🔥 ESSA LINHA É OBRIGATÓRIA
  mostrarReceitaPorMes()
}

function mostrarPagamentos(){

  let lista = document.getElementById("listaPagamentos")
  if(!lista) return

  lista.innerHTML = ""

  let pagamentosPorMes = {}

  // 🔹 Agrupar por mês
  for(let i=0;i<pagamentos.length;i++){
    let mes = pagamentos[i].mes

    if(!pagamentosPorMes[mes]){
      pagamentosPorMes[mes] = []
    }

    pagamentosPorMes[mes].push(pagamentos[i])
  }

  const ordemMeses = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ]

  ordemMeses.forEach(mes => {

    //if(!pagamentosPorMes[mes]) return
    let chave = Object.keys(pagamentosPorMes).find(m => 
  m.toLowerCase() === mes.toLowerCase()
)

if(!chave) return

    // 🔥 LINHA DE TÍTULO (CLICÁVEL)
    let titulo = document.createElement("tr")

    titulo.innerHTML = `
      <td colspan="5" style="cursor:pointer;font-weight:bold;background:#eee;text-align:left;padding-left:20px"
      onclick="toggleMes('${mes}', this)">
        ▶ ${mes}
      </td>
    `

    lista.appendChild(titulo)

    // 🔹 Ordena jogadores
    pagamentosPorMes[chave].sort((a,b) =>
      (a.jogador_nome || a.jogador || "").localeCompare(b.jogador_nome || b.jogador || "")
    )

    // 🔹 Linhas dos pagamentos
    //pagamentosPorMes[mes].forEach(p => {
      pagamentosPorMes[chave].forEach(p => {

      let tr = document.createElement("tr")

      tr.classList.add("mes-" + mes)
      //tr.style.display = "none"
      tr.style.display = "none"

      tr.innerHTML = `
        <td>${p.jogador_nome || p.jogador}</td>
        <td>${p.mes}</td>
        <td>${formatarMoeda(Number(p.valor))}</td>
        <td>${formatarDataBR(p.data)}</td>
        <td>
          <button onclick="removerPagamento(${p.id})">🗑️</button>
        </td>
      `

      lista.appendChild(tr)
     
    })
    
  })
  //mostrarPagamentos()
  calcularTotalMes()
}

async function removerPagamento(id){

  let confirmar = confirm("Deseja remover esse pagamento?")

  if(!confirmar){
    mostrarToast("Operação cancelada")
    return
  }

  await apiDelete("/pagamentos/" + id)

  mostrarToast("Pagamento removido com sucesso")

  // 🔥 FORÇA atualização real
  await carregarPagamentos()

  // 🔥 GARANTE render correto
  mostrarPagamentos()
}

function calcularTotalMes(){

  let totais = {}

  for(let i=0;i<pagamentos.length;i++){

    let mes = pagamentos[i].mes

    if(!totais[mes]){
      totais[mes] = 0
    }

    totais[mes] += Number(pagamentos[i].valor || 0)
  }

  // 🔥 NÃO MOSTRA MAIS NA TELA
  return totais
}

// Lançamento e controle de despesas//

async function registrarDespesa(){

let descricao = document.getElementById("descricaoDespesa").value
let valor = document.getElementById("valorDespesa").value

if(descricao === "" || valor === ""){
mostrarToast("Informe a descrição e o valor da despesa")
return
}

let hoje = new Date()

let data = new Date().toISOString()

let usuario = JSON.parse(localStorage.getItem("usuarioLogado"))
let turmaId = usuario.turma_id

let despesa = {
  descricao:descricao,
  valor:parseFloat(valor),
  data:data,
  turma_id: turmaId
}

// 🔥 SALVAR NO BACKEND
await apiPost("/despesas", despesa)

// 🔥 RECARREGAR DO BACKEND
await carregarDespesas()

// limpar campos
document.getElementById("descricaoDespesa").value=""
document.getElementById("valorDespesa").value=""

}

async function carregarDespesas(){

  let usuario = JSON.parse(localStorage.getItem("usuarioLogado"))
  let turmaId = usuario.turma_id

  despesas = await apiGet(`/despesas/${turmaId}`)

  console.log("Despesas carregadas:", despesas)

  mostrarDespesas()
  atualizarPainel()
}

function mostrarDespesas(){

  let lista = document.getElementById("listaDespesas")

  if(!lista) return

lista.innerHTML = ""

let despesasPorMes = {}

for(let i=0;i<despesas.length;i++){
  
  console.log("DESPESA:", despesas[i])

  let data = despesas[i].data

if(!data){
  console.warn("Despesa sem data:", despesas[i])
  continue
}

let mesNumero

if(data.includes("/")){
  let partes = data.split("/")
  mesNumero = Number(partes[1])
}else{
  let dataObj = new Date(data)
  mesNumero = dataObj.getMonth() + 1
}

  const nomesMeses = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ]

  let mes = nomesMeses[mesNumero - 1]

  if(!despesasPorMes[mes]){
    despesasPorMes[mes] = []
  }

  despesasPorMes[mes].push(despesas[i])
}

const ordemMeses = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
]

ordemMeses.forEach(mes => {

  if(!despesasPorMes[mes]) return

  let grupoId = "desp_" + mes

  let titulo = document.createElement("tr")

  titulo.innerHTML =
  `<td colspan="4" style="cursor:pointer;font-weight:bold;background:#eee;text-align:left;padding-left:20px"
  onclick="toggleMesDespesa('${grupoId}')">▶ ${mes}</td>`

  lista.appendChild(titulo)

  despesasPorMes[mes].forEach(d => {

    let tr = document.createElement("tr")
    tr.classList.add(grupoId)
    //tr.style.display = "none"
    

    tr.innerHTML = `
      <td>${d.descricao}</td>
      <td>${formatarMoeda(Number(d.valor))}</td>
      <td>${formatarDataBR(d.data)}</td>
      <td>
        <button onclick="removerDespesa(${d.id})">🗑️</button>
      </td>
    `

    lista.appendChild(tr)

  })

})

}

async function removerDespesa(id){

  console.log("REMOVENDO DESPESA:", id)

  let confirmar = confirm("Deseja excluir essa despesa?")

  if(!confirmar){
    mostrarToast("Operação cancelada")
    return
  }

  await apiDelete(`/despesas/${id}`)

  mostrarToast("Despesa removida com sucesso")

  await carregarDespesas()
}

function mostrarReceitaPorMes(){

  let mapa = {}

  for(let p of pagamentos){
    let d = p.data ? new Date(p.data) : null

if(!d || isNaN(d)){
  console.warn("Pagamento com data inválida:", p)
  continue
}

// 🔥 CORREÇÃO DO FUSO HORÁRIO
let data = new Date(
  d.getUTCFullYear(),
  d.getUTCMonth(),
  d.getUTCDate()
)

    let chave = `${data.getFullYear()}-${data.getMonth()}`

    let label = data.toLocaleString("pt-BR", {
      month: "long",
      year: "numeric"
    })

    if(!mapa[chave]){
      mapa[chave] = { label, total: 0, data }
    }

    mapa[chave].total += Number(p.valor || 0)
  }

  for(let r of receitas){
    let d = new Date(r.data)

let data = new Date(
  d.getUTCFullYear(),
  d.getUTCMonth(),
  d.getUTCDate()
)

    let chave = `${data.getFullYear()}-${data.getMonth()}`

    let label = data.toLocaleString("pt-BR", {
      month: "long",
      year: "numeric"
    })

    if(!mapa[chave]){
      mapa[chave] = { label, total: 0, data }
    }

    mapa[chave].total += Number(r.valor || 0)
  }

  let lista = Object.values(mapa).sort((a,b) => a.data - b.data)

  let div = document.getElementById("receitaPorMes")
  if(!div) return

  div.innerHTML = ""

  let limite = 3
  let expandido = false

  function render(){

    div.innerHTML = ""

    let dados = expandido ? lista : lista.slice(-limite)

    dados.forEach(item => {
      div.innerHTML += `
        <div class="linha-mes">
          <span>${item.label}</span>
          <strong>${formatarMoeda(item.total)}</strong>
        </div>
      `
    })

    if(lista.length > limite){
      div.innerHTML += `
        <button onclick="toggleReceitaMes()" class="btn-expandir">
          ${expandido ? "Ver menos" : "Ver mais"}
        </button>
      `
    }
  }

  window.toggleReceitaMes = function(){
    expandido = !expandido
    render()
  }

  render()
}

  function atualizarBotaoPagamento(){
  const botao = document.getElementById("btnPagamento");

  if(botao){
    botao.innerText = `Registrar Pagamento (${formatarMoeda(getMensalidade())})`
  }
}

async function salvarMensalidade(){
  const valor = document.getElementById("valorMensalidade").value;

  // salva localmente
  setMensalidade(valor);

  mostrarToast("Mensalidade atualizada!");

  atualizarBotaoPagamento();
}

function formatarDataBR(dataISO){

  if(!dataISO) return ""

  let partes = dataISO.split("T")[0].split("-")

  return `${partes[2]}/${partes[1]}/${partes[0]}`
}

async function registrarReceita(){

  let descricao = document.getElementById("descricaoReceita").value
  let valor = Number(document.getElementById("valorReceita").value)

  if(!descricao || !valor){
    mostrarToast("Preencha descrição e valor", "error")
    return
  }

  let usuario = JSON.parse(localStorage.getItem("usuarioLogado"))

  await apiPost("/receitas", {
    descricao,
    valor,
    turma_id: usuario.turma_id
  })

  mostrarToast("Entrada registrada!")

  document.getElementById("descricaoReceita").value = ""
  document.getElementById("valorReceita").value = ""

  carregarReceitas()
}

async function carregarReceitas(){

  let usuario = JSON.parse(localStorage.getItem("usuarioLogado"))

  receitas = await apiGet(`/receitas/${usuario.turma_id}`)

  let lista = document.getElementById("listaReceitas")
  lista.innerHTML = ""

  const meses = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ]

  const mapaMes = {}

  receitas.forEach(r => {

    let d = new Date(r.data)

let data = new Date(
  d.getUTCFullYear(),
  d.getUTCMonth(),
  d.getUTCDate()
)

    let mes = data.toLocaleString("pt-BR",{month:"long"})
    mes = mes.charAt(0).toUpperCase()+mes.slice(1)

    if(!mapaMes[mes]) mapaMes[mes] = []

    mapaMes[mes].push(r)
  })

  meses.forEach(mes => {

    if(!mapaMes[mes]) return

    lista.innerHTML += `
      <div style="margin-top:15px">

        <div style="font-weight:bold;cursor:pointer"
             onclick="toggleMesReceita('${mes}')">
          ▶ ${mes}
        </div>

        <table style="width:100%;border-collapse:collapse;display:none"
               id="receita_${mes}">

          <thead>
            <tr style="background:#1e293b;color:white">
              <th style="padding:8px;text-align:left">Descrição</th>
              <th style="padding:8px">Valor</th>
              <th style="padding:8px">Data</th>
              <th style="padding:8px">Ações</th>
            </tr>
          </thead>

          <tbody>
            ${mapaMes[mes].map(r => `
              <tr>
                <td style="padding:8px">${r.descricao}</td>
                <td style="padding:8px">${formatarMoeda(r.valor)}</td>
                <td style="padding:8px">${formatarDataBR(r.data)}</td>
                <td style="padding:8px">
                  <button onclick="excluirReceita(${r.id})"
                    style="background:#ef4444;border:none;color:white;padding:6px 10px;border-radius:6px">
                    🗑️
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>

        </table>

      </div>
    `
  })

  mostrarReceitaPorMes()
}

function mostrarDespesasPorMes(){

  let container = document.getElementById("despesasPorMes")
  if(!container) return

  let mapa = {}

  for(let d of despesas){

    let data = new Date(d.data)

    let chave = `${data.getFullYear()}-${data.getMonth()}`

    let label = data.toLocaleString("pt-BR", {
      month: "long",
      year: "numeric"
    })

    if(!mapa[chave]){
      mapa[chave] = { label, total: 0, data }
    }

    mapa[chave].total += Number(d.valor)
  }

  let lista = Object.values(mapa).sort((a,b) => a.data - b.data)

  let limite = 3
  let expandido = false

  function render(){

    container.innerHTML = ""

    let dados = expandido ? lista : lista.slice(-limite)

    dados.forEach(item => {
      container.innerHTML += `
        <div class="linha-mes">
          <span>${item.label}</span>
          <strong>${formatarMoeda(item.total)}</strong>
        </div>
      `
    })

    if(lista.length > limite){
      container.innerHTML += `
        <button onclick="toggleDespesasMes()" class="btn-expandir">
          ${expandido ? "Ver menos" : "Ver mais"}
        </button>
      `
    }
  }

  window.toggleDespesasMes = function(){
    expandido = !expandido
    render()
  }

  render()
}

function mostrarResultadoFinanceiroPorMes(){

  let container = document.getElementById("resultadoFinanceiroPorMes")
  if(!container) return

  let mapa = {}

  // 🔵 RECEITAS (pagamentos + receitas extras)
  for(let p of pagamentos){

    let d = new Date(p.data)
    let data = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())

    let chave = `${data.getFullYear()}-${data.getMonth()}`
    let label = data.toLocaleString("pt-BR", { month: "long", year: "numeric" })

    if(!mapa[chave]){
      mapa[chave] = { label, receita: 0, despesa: 0, data }
    }

    mapa[chave].receita += Number(p.valor || 0)
  }

  for(let r of receitas){

    let d = new Date(r.data)
    let data = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())

    let chave = `${data.getFullYear()}-${data.getMonth()}`
    let label = data.toLocaleString("pt-BR", { month: "long", year: "numeric" })

    if(!mapa[chave]){
      mapa[chave] = { label, receita: 0, despesa: 0, data }
    }

    mapa[chave].receita += Number(r.valor || 0)
  }

  // 🔴 DESPESAS
  for(let d of despesas){

    let dd = new Date(d.data)
    let data = new Date(dd.getUTCFullYear(), dd.getUTCMonth(), dd.getUTCDate())

    let chave = `${data.getFullYear()}-${data.getMonth()}`
    let label = data.toLocaleString("pt-BR", { month: "long", year: "numeric" })

    if(!mapa[chave]){
      mapa[chave] = { label, receita: 0, despesa: 0, data }
    }

    mapa[chave].despesa += Number(d.valor || 0)
  }

  let lista = Object.values(mapa).sort((a,b) => a.data - b.data)

  let limite = 3
  let expandido = false

  function render(){

    container.innerHTML = ""

    let dados = expandido ? lista : lista.slice(0, limite)

    dados.forEach(item => {

      let saldo = item.receita - item.despesa

      let cor = saldo >= 0 ? "green" : "red"

      container.innerHTML += `
        <div class="linha-mes">
          <span>${item.label}</span>
          <strong style="color:${cor}">
            ${saldo >= 0 ? "+" : ""}${formatarMoeda(saldo)}
          </strong>
        </div>
      `
    })

    if(lista.length > limite){
      container.innerHTML += `
        <button onclick="toggleResultadoFinanceiro()" class="btn-expandir">
          ${expandido ? "Ver menos" : "Ver mais"}
        </button>
      `
    }
  }

  window.toggleResultadoFinanceiro = function(){
    expandido = !expandido
    render()
  }

  render()
}

async function excluirReceita(id){

  let pode = await usuarioTemPermissao("financeiro", "excluir")

  if(!pode){
    mostrarToast("Sem permissão", "error")
    return
  }

  if(!confirm("Deseja excluir essa entrada?")) return

  await apiDelete(`/receitas/${id}`)

  mostrarToast("Entrada removida!")

  carregarReceitas()
  atualizarPainel()
}

function mostrarPagamentosMobile(){

  let container = document.getElementById("listaPagamentosMobile")
  if(!container) return

  let grupos = {}

  pagamentos.forEach(p => {
    let mes = p.mes || p.mes_pagamento || extrairMes(p.data)

if(!grupos[mes]){
  grupos[mes] = []
}

grupos[mes].push(p)
  })

container.innerHTML = Object.keys(grupos).map(mes => {

  let chave = normalizarMes(mes)

  return `

    <!-- 🔹 MÊS -->
    <div class="mes-card" onclick="toggleMesMobile('${chave}')">
  ▶ ${mes}
    </div>

    <div id="grupo_${chave}" style="display:none">

      ${grupos[mes].map(p => `

        <!-- 🔸 JOGADOR -->
        <div class="card-pagamento" onclick="togglePagamento(${p.id})">
          👤 ${p.jogador_nome || p.jogador || "Sem nome"}
        </div>

        <!-- 🔸 DETALHE -->
        <div id="detalhe_pag_${p.id}" class="detalhe-pagamento" style="display:none">
          💰 ${formatarMoeda(p.valor)} <br>
          📆 ${formatarDataBR(p.data)} <br><br>

          <button onclick="removerPagamento(${p.id})">🗑️</button>
        </div>

      `).join("")}

    </div>

  `
}).join("")
}
function renderPagamentos(){

  let mobile = window.matchMedia("(max-width: 768px)").matches

  if(mobile){
    document.getElementById("tabelaPagamentos").style.display = "none"
    document.getElementById("listaPagamentosMobile").style.display = "block"

    mostrarPagamentosMobile()

  } else {
    document.getElementById("tabelaPagamentos").style.display = "table"
    document.getElementById("listaPagamentosMobile").style.display = "none"

    mostrarPagamentos()
  }
}

function toggleMesMobile(mes){

  let el = document.getElementById("grupo_" + mes)

  if(!el){
    console.warn("Não encontrou:", mes)
    return
  }

  let aberto = el.style.display === "block"

  el.style.display = aberto ? "none" : "block"
}

function togglePagamento(id){

  let el = document.getElementById("detalhe_pag_" + id)
  if(!el) return

  let aberto = el.style.display === "block"

  el.style.display = aberto ? "none" : "block"
}

function toggleMesInad(id){

  let el = document.getElementById(id)

  if(!el){
    console.warn("Não encontrou:", id)
    return
  }

  let aberto = el.style.display === "block"

  el.style.display = aberto ? "none" : "block"
}

// ===== UTIL =====
function extrairMes(data){

  let d = new Date(data)

  let meses = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ]

  return meses[d.getMonth()]
}


