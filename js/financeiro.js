let pagamentos = []
let despesas = []

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

  let dataPagamento =
    hoje.getDate().toString().padStart(2,"0") + "/" +
    (hoje.getMonth()+1).toString().padStart(2,"0") + "/" +
    hoje.getFullYear()

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

  mostrarPagamentos()
  atualizarPainel()

  // 🔥 ESSA LINHA É OBRIGATÓRIA
  mostrarReceitaPorMes()
}

function mostrarPagamentos(){

let lista = document.getElementById("listaPagamentos")
lista.innerHTML = ""

let pagamentosPorMes = {}

for(let i=0;i<pagamentos.length;i++){

let mes = pagamentos[i].mes

if(!pagamentosPorMes[mes]){
pagamentosPorMes[mes] = []
}

pagamentosPorMes[mes].push({
dados:pagamentos[i],
index:i
})

}
const ordemMeses = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
]
ordemMeses.forEach(mes => {

  if(!pagamentosPorMes[mes]) return

  pagamentosPorMes[mes].sort((a,b) =>
    (a.dados.jogador || "").localeCompare(b.dados.jogador || "")
  )

  let titulo = document.createElement("tr")

  titulo.innerHTML =
  `<td colspan='5' style='cursor:pointer;font-weight:bold;background:#eee;text-align:left;padding-left:20px' onclick='toggleMes("mes_${mes}")'>▶ ${mes}</td>`

  lista.appendChild(titulo)

  let grupo = document.createElement("tbody")
  grupo.id = "mes_" + mes
  grupo.style.display = "none"

  for(let i=0;i<pagamentosPorMes[mes].length;i++){

    let item = pagamentosPorMes[mes][i]
    let p = item.dados

    let tr = document.createElement("tr")

    tr.innerHTML = `
      <td>${p.jogador_nome || p.jogador}</td>
      <td>${p.mes}</td>
      <td>${formatarMoeda(Number(p.valor))}</td>
      <td>${formatarDataBR(p.data)}</td>
      <td>
        <button onclick="removerPagamento(${p.id})">🗑️</button>
      </td>
    `

    grupo.appendChild(tr)
  }

  lista.appendChild(grupo)

})

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
  //mostrarPagamentos()
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

let data =
hoje.getDate().toString().padStart(2,"0") + "/" +
(hoje.getMonth()+1).toString().padStart(2,"0") + "/" +
hoje.getFullYear()

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

  let partes = despesas[i].data.split("/") // "20/03/2026"
  let mesNumero = Number(partes[1])

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
  onclick="toggleMes('${grupoId}')">▶ ${mes}</td>`

  lista.appendChild(titulo)

  despesasPorMes[mes].forEach(d => {

    let tr = document.createElement("tr")
    tr.classList.add(grupoId)
    tr.style.display = "none"

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

  console.log("🔥 FUNÇÃO RECEITA POR MÊS RODOU")
  console.log("💰 PAGAMENTOS:", pagamentos)

  let totais = {}

  for(let i=0;i<pagamentos.length;i++){

    let mes = pagamentos[i].mes

    if(!totais[mes]){
      totais[mes] = 0
    }

    totais[mes] += Number(pagamentos[i].valor || 0)
  }

  let div = document.getElementById("receitaPorMes")

  if(!div) return

  div.innerHTML = ""

  // 🔥 ORDEM CORRETA DOS MESES
  let ordemMeses = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ]

  ordemMeses.forEach(mes => {
    if(totais[mes]){
      div.innerHTML += `
        <div style="
          display:flex;
          justify-content:space-between;
          padding:6px 0;
          border-bottom:1px solid #eee;
        ">
          <span>${mes}</span>
          <strong>${formatarMoeda(totais[mes])}</strong>
        </div>
      `
    }
  })
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
