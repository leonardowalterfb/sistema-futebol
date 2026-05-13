const API =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://sistema-futebol-1.onrender.com";

// GET
async function apiGet(url){
  try {

    let token = localStorage.getItem("token")

let res = await fetch(API + url, {
  headers: {
    "Authorization": "Bearer " + token
  }
})

    let data = await res.json()

    if(res.status === 401){

  localStorage.removeItem("token")
  localStorage.removeItem("usuarioLogado")

  mostrarToast("Sessão expirada. Faça login novamente.")

  setTimeout(() => {
    location.reload()
  }, 1000)

  throw data
}

if(!res.ok){
  throw data
}

    return data

  } catch (e){

    console.error("Erro API:", e)

    if(e.erro){
  mostrarToast(e.erro)
}else{
  mostrarToast("⚠️ Servidor offline ou indisponível")
}

    //return []
    throw e
  }
}

// POST
async function apiPost(url, body){

  let usuario = JSON.parse(localStorage.getItem("usuarioLogado"))

  let res = await fetch(API + url, {
    method: "POST",
    headers: {
  "Content-Type": "application/json",
  "Authorization": "Bearer " + localStorage.getItem("token")
},
      body: JSON.stringify(body)
  })

  let data

  try {
    data = await res.json()
  } catch {
    throw { erro: "Erro inesperado do servidor" }
  }

  if(res.status === 401){

  localStorage.removeItem("token")
  localStorage.removeItem("usuarioLogado")

  mostrarToast("Sessão expirada")

  setTimeout(() => {
    location.reload()
  }, 1000)

  throw data
}

if(!res.ok){
  throw data
}

  return data
}

// PUT
async function apiPut(url, body){

  let token = localStorage.getItem("token")

  let res = await fetch(API + url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify(body)
  })

  let data

  try {
    data = await res.json()
  } catch {
    throw new Error("Erro inesperado do servidor")
  }

 if(res.status === 401){

  localStorage.removeItem("token")
  localStorage.removeItem("usuarioLogado")

  mostrarToast("Sessão expirada")

  setTimeout(() => {
    location.reload()
  }, 1000)

  throw data
}

if(!res.ok){
  throw new Error(data.erro || "Erro ao atualizar")
}

  return data
}

// DELETE
async function apiDelete(url){

  let token = localStorage.getItem("token")

  let res = await fetch(API + url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    }
  })

  let data

  try {
    data = await res.json()
  } catch {
    throw { erro: "Erro inesperado ao deletar" }
  }

  if(res.status === 401){

  localStorage.removeItem("token")
  localStorage.removeItem("usuarioLogado")

  mostrarToast("Sessão expirada")

  setTimeout(() => {
    location.reload()
  }, 1000)

  throw data
}

if(!res.ok){
  throw data
}

  return data
}

//DASHBOARD

async function carregarDashboard(){
  let usuario = JSON.parse(localStorage.getItem("usuarioLogado"))
  let turmaId = usuario.turma_id

  return await apiGet(`/dashboard/${turmaId}`)
}
