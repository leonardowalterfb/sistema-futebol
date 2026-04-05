const API =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://sistema-futebol.onrender.com";

// GET
async function apiGet(url){

  let res = await fetch(API + url)

  let data

  try {
    data = await res.json()
  } catch {
    throw { erro: "Erro ao buscar dados" }
  }

  if(!res.ok){
    throw data
  }

  return data
}

// POST
async function apiPost(url, body){

  let res = await fetch(API + url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  })

  let data

  try {
    data = await res.json()
  } catch {
    throw { erro: "Erro inesperado do servidor" }
  }

  if(!res.ok){
    throw data // 🔥 AQUI A MÁGICA
  }

  return data
}

// PUT
async function apiPut(url, body){

  let res = await fetch(API + url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  })

  let data

  try {
    data = await res.json()
  } catch {
    throw new Error("Erro inesperado do servidor")
  }

  if(!res.ok){
    throw new Error(data.erro || "Erro ao atualizar")
  }

  return data
}

// DELETE
async function apiDelete(url){

  let res = await fetch(API + url, {
    method: "DELETE"
  })

  let data

  try {
    data = await res.json()
  } catch {
    throw { erro: "Erro inesperado ao deletar" }
  }

  if(!res.ok){
    throw data
  }

  return data
}

