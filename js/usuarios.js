async function carregarUsuariosPermissoes(){  
  
  let turmaSelecionada = JSON.parse(
    localStorage.getItem("turmaSelecionada")
  )

  if(!turmaSelecionada){
    mostrarToast("Selecione uma turma primeiro", "error")
    return
  }

  let turmaId = Number(turmaSelecionada.turma_id)

  let usuarios = await apiGet(`/usuarios/${turmaId}`)

  let select = document.getElementById("selectUsuario")

  select.innerHTML = ""

  usuarios.forEach(u => {
    select.innerHTML += `<option value="${u.id}">${u.nome}</option>`
  })

  carregarPermissoes()
}

async function carregarPermissoes(){

  let turmaSelecionada = JSON.parse(
    localStorage.getItem("turmaSelecionada")
  )

  if(!turmaSelecionada){
    mostrarToast("Selecione uma turma primeiro", "error")
    return
  }

  let turmaId = Number(turmaSelecionada.turma_id)

  let usuarioId = Number(
    document.getElementById("selectUsuario").value
  )

  if(!Number.isInteger(usuarioId)){
    return
  }

  let permissoes = await apiGet(
    `/permissoes/${turmaId}/${usuarioId}`
  )

  document.querySelectorAll(
    "#aba-permissoes input[type=checkbox]"
  ).forEach(c => {
    c.checked = false
  })

  permissoes.forEach(p => {

    let id = `perm_${p.modulo}_${p.acao}`

    let el = document.getElementById(id)

    if(el){
      el.checked = p.permitido
    }

  })
}

async function salvarPermissoes(){

  let turmaSelecionada = JSON.parse(
    localStorage.getItem("turmaSelecionada")
  )

  if(!turmaSelecionada){
    mostrarToast("Selecione uma turma primeiro", "error")
    return
  }

  let usuarioId = Number(
    document.getElementById("selectUsuario").value
  )

  let turmaId = Number(turmaSelecionada.turma_id)

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
    turma_id: turmaId,
    permissoes: lista
  })

  mostrarToast("Permissões salvas!")
}

async function usuarioTemPermissao(modulo, acao){

  let usuario = JSON.parse(
    localStorage.getItem("usuarioLogado")
  )

  if(!usuario){
    return false
  }

  if(usuario.is_master){
    return true
  }

  let turmaSelecionada = JSON.parse(
    localStorage.getItem("turmaSelecionada")
  )

  if(!turmaSelecionada){
    return false
  }

  let turmaId = Number(
    turmaSelecionada.turma_id
  )

  if(!Number.isInteger(turmaId)){
    return false
  }

  try {

    let permissoes = await apiGet(
      `/permissoes/${turmaId}/${usuario.id}`
    )

    let perm = permissoes.find(p =>
      p.modulo === modulo &&
      p.acao === acao
    )

    return perm?.permitido === true

  } catch(err) {

    console.error(
      "Erro ao verificar permissão:",
      err
    )

    return false
  }
}

async function validarPermissao(modulo, acao){

  let pode = await usuarioTemPermissao(modulo, acao)

  if(!pode){
    mostrarToast("Você não tem autorização para essa ação", "error")
    return false
  }

  return true
}