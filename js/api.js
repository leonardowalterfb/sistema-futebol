const API =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://sistema-futebol-1.onrender.com";

// GET
async function apiGet(url){
  try {

    let res = await fetch(API + url)

    let data = await res.json()

    if(!res.ok){
      throw data
    }

    return data

  } catch (e){

    console.error("Erro API:", e)

    mostrarToast("⚠️ Servidor offline ou indisponível")

    return []
  }
}

// POST
async function apiPost(url, body){

  let usuario = JSON.parse(localStorage.getItem("usuarioLogado"))

  let res = await fetch(API + url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...body,
      usuario_id: usuario?.id 
    })
  })

  let data

  try {
    data = await res.json()
  } catch {
    throw { erro: "Erro inesperado do servidor" }
  }

  if(!res.ok){
    throw data
  }

  return data
}

// PUT
async function apiPut(url, body){

  let usuario = JSON.parse(localStorage.getItem("usuarioLogado"))

  let res = await fetch(API + url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...body,
      usuario_id: usuario?.id // 🔥 AQUI ESTÁ A MUDANÇA
    })
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

  let usuario = JSON.parse(localStorage.getItem("usuarioLogado"))

  let res = await fetch(API + url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      usuario_id: usuario?.id
    })
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

