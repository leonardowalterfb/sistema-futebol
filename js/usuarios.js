async function carregarUsuariosPermissoes(){  
  
  let usuario = JSON.parse(localStorage.getItem("usuarioLogado"))  
  
  let usuarios = await apiGet(`/usuarios/${usuario.turma_id}`)  
  
  let select = document.getElementById("selectUsuario")  
  
  select.innerHTML = ""  
  
  usuarios.forEach(u => {  
    select.innerHTML += `<option value="${u.id}">${u.nome}</option>`  
  })  
  
  carregarPermissoes()  
}

async function carregarPermissoes(){

  let usuarioId = document.getElementById("selectUsuario").value

  let permissoes = await apiGet(`/permissoes/${usuarioId}`)

  document.querySelectorAll("#aba-permissoes input[type=checkbox]")
    .forEach(c => c.checked = false)

  permissoes.forEach(p => {
    let id = `perm_${p.modulo}_${p.acao}`
    let el = document.getElementById(id)
    if(el){
      el.checked = p.permitido
    }
  })
}

async function salvarPermissoes(){

  let usuarioId = document.getElementById("selectUsuario").value

  let lista = []

  document.querySelectorAll("#aba-permissoes input[type=checkbox]")
    .forEach(c => {

      let partes = c.id.split("_")

      lista.push({
        modulo: partes[1],
        acao: partes[2],
        permitido: c.checked
      })
    })

  await apiPost("/permissoes", {
    usuario_id: usuarioId,
    permissoes: lista
  })

  mostrarToast("Permissões salvas!")
}

async function usuarioTemPermissao(modulo, acao){

  let usuario = JSON.parse(localStorage.getItem("usuarioLogado"))

  if(!usuario) return false

  // 🔥 MASTER LIBERADO
  if(usuario.is_master) return true

  try {
    let permissoes = await apiGet(`/permissoes/${usuario.id}`)

    let perm = permissoes.find(p =>
      p.modulo === modulo && p.acao === acao
    )

    return perm && perm.permitido === true

  } catch {
    return false
  }
}