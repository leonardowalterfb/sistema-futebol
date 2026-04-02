let pagamentos = []
let despesas = []

//PAGAMENTOS//

async function registrarPagamento(){

  console.log("Clicou em registrar pagamento")

  let jogador=document.getElementById("jogadorPagamento").value
  let mes=document.getElementById("mesPagamento").value

  let pagamentoExistente = pagamentos.find(p =>
    p.jogador===jogador && p.mes===mes
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

let pagamento={
  jogador:jogador,
  mes:mes,
  valor:50,
  data:dataPagamento,
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

for(let mes in pagamentosPorMes){

  pagamentosPorMes[mes].sort((a,b) =>
    a.dados.jogador.localeCompare(b.dados.jogador)
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
      <td>${p.jogador}</td>
      <td>${p.mes}</td>
      <td>${formatarMoeda(p.valor)}</td>
      <td>${p.data}</td>
      <td>
        <button onclick="removerPagamento(${p.id})">🗑️</button>
      </td>
    `

    grupo.appendChild(tr)
  }

  lista.appendChild(grupo)
}

calcularTotalMes()

}

async function removerPagamento(id){

  let confirmar = confirm("Deseja remover esse pagamento?")

  if(!confirmar){
    mostrarToast("Operação cancelada")
    return
  }

  await fetch("http://localhost:3000/pagamentos/" + id, {
    method: "DELETE"
  })

  mostrarToast("Pagamento removido com sucesso")

  await carregarPagamentos()
}

function calcularTotalMes(){

  let totais = {}

  for(let i=0;i<pagamentos.length;i++){

    let mes = pagamentos[i].mes

    if(!totais[mes]){
      totais[mes] = 0
    }

    totais[mes] += pagamentos[i].valor
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
await fetch("http://localhost:3000/despesas", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(despesa)
})

// 🔥 RECARREGAR DO BACKEND
await carregarDespesas()

// limpar campos
document.getElementById("descricaoDespesa").value=""
document.getElementById("valorDespesa").value=""

}

async function carregarDespesas(){

  let usuario = JSON.parse(localStorage.getItem("usuarioLogado"))
  let turmaId = usuario.turma_id

  let resposta = await fetch(`http://localhost:3000/despesas/${turmaId}`)
  despesas = await resposta.json()

  console.log("Despesas carregadas:", despesas)

  mostrarDespesas()
  atualizarPainel()
}

function mostrarDespesas(){

  let lista = document.getElementById("listaDespesas")

  if(!lista) return

  lista.innerHTML = ""

  for(let i = 0; i < despesas.length; i++){

    let d = despesas[i]

    lista.innerHTML += `
      <tr>
        <td>${d.descricao}</td>
        <td>${formatarMoeda(d.valor)}</td>
        <td>${d.data}</td>
        <td>
          <button onclick="removerDespesa(${d.id})">🗑️</button>
        </td>
      </tr>
    `
  }
}

async function removerDespesa(id){

  console.log("REMOVENDO DESPESA:", id)

  let confirmar = confirm("Deseja excluir essa despesa?")

  if(!confirmar){
    mostrarToast("Operação cancelada")
    return
  }

  await fetch("http://localhost:3000/despesas/" + id, {
    method: "DELETE"
  })

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

    totais[mes] += pagamentos[i].valor
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