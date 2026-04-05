// CONFIG GLOBAL
let valorMensalidade = 0;

function setMensalidade(valor){
  valorMensalidade = Number(valor);
  localStorage.setItem("mensalidade", valorMensalidade);
}

function getMensalidade(){
  return valorMensalidade;
}

function carregarMensalidadeLocal(){
  const valor = localStorage.getItem("mensalidade");
  if(valor){
    valorMensalidade = Number(valor);
  }
}

// já carrega quando abrir o sistema
carregarMensalidadeLocal();

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
  }, 3000)
}

// LOGOUT
function logout(){
  localStorage.removeItem("usuarioLogado")
  location.reload()
}