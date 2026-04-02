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

return valor.toLocaleString("pt-BR", {
style: "currency",
currency: "BRL"
})

}

function formatarData(dataISO){

  if(!dataISO) return "-"

  let partes = dataISO.split("-") // yyyy-mm-dd

  return partes[2] + "/" + partes[1] + "/" + partes[0]
}

function formatarDataBR(data){

  if(!data) return "-"

  // se vier no formato yyyy-mm-dd
  if(data.includes("-")){
    let partes = data.split("-")
    return partes[2] + "/" + partes[1] + "/" + partes[0]
  }

  // fallback (caso venha diferente)
  return data
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