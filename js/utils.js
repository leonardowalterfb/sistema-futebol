// utils.js

//=====================
// HELPERS DE STORAGE
//=====================

function getTurmaSelecionada(){
  try {
    return JSON.parse(localStorage.getItem("turmaSelecionada"))
  } catch(err) {
    console.error("Erro ao ler turmaSelecionada do localStorage:", err)
    return null
  }
}

function getUsuarioLogado(){
  try {
    return JSON.parse(localStorage.getItem("usuarioLogado"))
  } catch(err) {
    console.error("Erro ao ler usuarioLogado do localStorage:", err)
    return null
  }
}


//=====================
// FORMATAÇÕES
//=====================

function formatarMoeda(valor){

  let num = Number(valor)

  if(isNaN(num)) num = 0

  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  })
}

function formatarData(data){

  if(!data) return "-"

  let d = new Date(data)

  if(isNaN(d)) return "-"

  let dia = String(d.getDate()).padStart(2, "0")
  let mes = String(d.getMonth() + 1).padStart(2, "0")
  let ano = d.getFullYear()

  return `${dia}/${mes}/${ano}`
}

// Mantido por compatibilidade com código existente que já usa esse nome
const formatarDataBR = formatarData

function calcularIdade(data){

  if(!data) return null

  let hoje = new Date()
  let nascimento = new Date(data)

  if(isNaN(nascimento)) return null

  let idade = hoje.getFullYear() - nascimento.getFullYear()
  let mes = hoje.getMonth() - nascimento.getMonth()

  if(mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())){
    idade--
  }

  return idade
}


//=====================
// TOAST
//=====================

let _toastTimeoutId = null

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

  // Cancela qualquer timeout pendente de um toast anterior,
  // evitando que um toast novo seja escondido antes da hora
  if(_toastTimeoutId){
    clearTimeout(_toastTimeoutId)
    _toastTimeoutId = null
  }

  toast.innerText = mensagem
  toast.className = ""

  toast.style.background =
    tipo === "success" ? "#16a34a" : "#dc2626"

  toast.style.display = "block"
  toast.classList.add("show")

  _toastTimeoutId = setTimeout(() => {

    toast.classList.remove("show")
    toast.style.display = "none"
    _toastTimeoutId = null

  }, 8000)

}


//=====================
// LOGOUT
//=====================

function logout(){

  // Remove todos os dados da sessão para evitar vazamento
  // de informações entre usuários no mesmo navegador
  localStorage.clear()

  location.reload()
}


//=====================
// VALOR MENSALIDADE
//=====================

function setMensalidade(valor){

  let turmaSelecionada = getTurmaSelecionada()

  if(!turmaSelecionada){
    console.warn("Nenhuma turma selecionada")
    return
  }

  let num = Number(valor)

  if(isNaN(num) || num < 0){
    console.warn("Valor de mensalidade inválido:", valor)
    return
  }

  let turmaId = Number(turmaSelecionada.turma_id)

  localStorage.setItem("mensalidade_" + turmaId, num)

}

function getMensalidade(){

  let turmaSelecionada = getTurmaSelecionada()

  if(!turmaSelecionada){
    console.warn("Nenhuma turma selecionada")
    return 0
  }

  let turmaId = Number(turmaSelecionada.turma_id)

  return Number(
    localStorage.getItem("mensalidade_" + turmaId) || 0
  )

}