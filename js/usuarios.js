// usuarios.js

// Cache simples de permissões para evitar requisições repetidas
let _cachePermissoes = null
let _cacheKey = null

function _invalidarCachePermissoes(){
  _cachePermissoes = null
  _cacheKey = null
}

function _getTurmaSelecionada(){
  try {
    return JSON.parse(localStorage.getItem("turmaSelecionada"))
  } catch(err) {
    console.error("Erro ao ler turmaSelecionada:", err)
    return null
  }
}

function _getUsuarioLogado(){
  try {
    return JSON.parse(localStorage.getItem("usuarioLogado"))
  } catch(err) {
    console.error("Erro ao ler usuarioLogado:", err)
    return null
  }
}

async function carregarUsuariosPermissoes(){

  try {

    let turmaSelecionada = _getTurmaSelecionada()

    if(!turmaSelecionada){
      mostrarToast("Selecione uma turma primeiro", "error")
      return
    }

    let turmaId = Number(turmaSelecionada.turma_id)

    if(!Number.isInteger(turmaId)){
      mostrarToast("Turma inválida", "error")
      return
    }

    let usuarios = await apiGet(`/usuarios/${turmaId}`)

    let select = document.getElementById("selectUsuario")

    // Limpa o select de forma segura
    select.innerHTML = ""

    usuarios.forEach(u => {
      let option = document.createElement("option")
      option.value = u.id
      option.textContent = u.nome
      select.appendChild(option)
    })

    await carregarPermissoes()

  } catch(err) {

    console.error("Erro ao carregar usuários:", err)
    mostrarToast("Erro ao carregar usuários", "error")
  }
}

async function carregarPermissoes(){

  try {

    let turmaSelecionada = _getTurmaSelecionada()

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

  } catch(err) {

    console.error("Erro ao carregar permissões:", err)
    mostrarToast("Erro ao carregar permissões", "error")
  }
}

async function salvarPermissoes(){

  try {

    let turmaSelecionada = _getTurmaSelecionada()

    if(!turmaSelecionada){
      mostrarToast("Selecione uma turma primeiro", "error")
      return
    }

    let usuarioId = Number(
      document.getElementById("selectUsuario").value
    )

    if(!Number.isInteger(usuarioId)){
      mostrarToast("Selecione um usuário primeiro", "error")
      return
    }

    let turmaId = Number(turmaSelecionada.turma_id)

    let lista = []

    document.querySelectorAll("#aba-permissoes input[type=checkbox]")
      .forEach(c => {

        // id no formato: perm_{modulo}_{acao}
        // Usamos slice para suportar módulos com underscore no nome
        // (ex: "perm_gestao_financeira_criar" -> modulo="gestao_financeira", acao="criar")
        let partes = c.id.split("_")

        let acao = partes[partes.length - 1]
        let modulo = partes.slice(1, -1).join("_")

        lista.push({
          modulo: modulo,
          acao: acao,
          permitido: c.checked
        })
      })

    await apiPost("/permissoes", {
      usuario_id: usuarioId,
      turma_id: turmaId,
      permissoes: lista
    })

    // Invalida o cache pois as permissões mudaram
    _invalidarCachePermissoes()

    mostrarToast("Permissões salvas!")

  } catch(err) {

    console.error("Erro ao salvar permissões:", err)
    mostrarToast("Erro ao salvar permissões", "error")
  }
}

async function usuarioTemPermissao(modulo, acao){

  let usuario = _getUsuarioLogado()

  if(!usuario){
    return false
  }

  if(usuario.is_master){
    return true
  }

  let turmaSelecionada = _getTurmaSelecionada()

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

    let chave = `${turmaId}_${usuario.id}`

    // Usa cache se a chave (turma + usuário) não mudou
    if(_cacheKey !== chave){
      _cachePermissoes = await apiGet(
        `/permissoes/${turmaId}/${usuario.id}`
      )
      _cacheKey = chave
    }

    let perm = _cachePermissoes.find(p =>
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

// Chame isso sempre que o usuário trocar de turma,
// para garantir que o cache de permissões não fique desatualizado
function onTrocaDeTurma(){
  _invalidarCachePermissoes()
}