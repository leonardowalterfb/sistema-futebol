//FORMATAÇÕES//

function formatarMoeda(valor){

  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  })
}

function formatarData(dataISO){
  if(!dataISO) return "-"

  const data = new Date(dataISO)

  if(isNaN(data)) return "-"

  return data.toLocaleDateString("pt-BR")
}

function formatarDataBR(data){

  if(!data) return "-"

  let d = new Date(data)

  if(isNaN(d)) return data

  let dia = String(d.getDate()).padStart(2, "0")
  let mes = String(d.getMonth() + 1).padStart(2, "0")
  let ano = d.getFullYear()

  return `${dia}/${mes}/${ano}`
}

function calcularIdade(data){

let hoje = new Date()
let nascimento = new Date(data)

let idade = hoje.getFullYear() - nascimento.getFullYear()

let mes = hoje.getMonth() - nascimento.getMonth()

if(mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())){
idade--
}

return idade

}

function mostrarToast(mensagem, tipo = "success"){

  let toast = document.getElementById("toast")

  toast.innerText = mensagem
  toast.className = ""
  toast.classList.add("show")

  if(tipo === "success"){
    toast.classList.add("toast-success")
  } else {
    toast.classList.add("toast-error")
  }

  setTimeout(() => {
    toast.classList.remove("show")
  }, 8000)
}

// LOGOUT
function logout(){
  localStorage.removeItem("usuarioLogado")
  location.reload()
}

//VALOR MENSALIDADE 

function setMensalidade(valor){

  let turmaSelecionada = JSON.parse(
    localStorage.getItem("turmaSelecionada")
  )

  if(!turmaSelecionada){
    console.warn("Nenhuma turma selecionada")
    return
  }

  let turmaId = Number(turmaSelecionada.turma_id)

  localStorage.setItem("mensalidade_" + turmaId, valor)

}

function getMensalidade(){

  let turmaSelecionada = JSON.parse(
    localStorage.getItem("turmaSelecionada")
  )

  if(!turmaSelecionada){
    console.warn("Nenhuma turma selecionada")
    return 0
  }

  let turmaId = Number(turmaSelecionada.turma_id)

  return Number(
    localStorage.getItem("mensalidade_" + turmaId) || 0
  )

}