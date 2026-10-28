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

  // Cria o elemento caso ainda não exista na página
  if(!toast){

    toast = document.createElement("div")
    toast.id = "toast"

    toast.style.position = "fixed"
    toast.style.bottom = "20px"
    toast.style.right = "20px"
    toast.style.zIndex = "99999"
    toast.style.padding = "12px 18px"
    toast.style.borderRadius = "8px"
    toast.style.color = "#fff"
    toast.style.fontWeight = "600"
    toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)"
    toast.style.maxWidth = "90%"
    toast.style.display = "none"

    document.body.appendChild(toast)

  }

  toast.innerText = mensagem
  toast.className = ""

  toast.style.background =
    tipo === "success" ? "#16a34a" : "#dc2626"

  toast.style.display = "block"
  toast.classList.add("show")

  setTimeout(() => {

    toast.classList.remove("show")
    toast.style.display = "none"

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