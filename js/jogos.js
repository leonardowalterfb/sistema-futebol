let historicoJogos = []
let jogosAgendados = []
let ranking = {}
let mostrarTodosRanking = false

//CRIAR JOGO//

//CRIAR JOGO//

async function criarJogo(){

  let pode = await usuarioTemPermissao("jogos", "criar")

  if(!pode){
    mostrarToast("Sem permissão", "error")
    return
  }

  let data = document.getElementById("dataJogo").value
  let hora = document.getElementById("horaJogo").value
  let local = document.getElementById("localJogo").value
  let tipoJogo = document.getElementById("tipoJogo").value

  if(data === "" || hora === "" || local === ""){
    mostrarToast(
      "Informe a data, a hora e o local antes de criar o jogo.",
      "error"
    )
    return
  }

  let turmaSelecionada = JSON.parse(
    localStorage.getItem("turmaSelecionada")
  )

  if(!turmaSelecionada){
    mostrarToast("Selecione uma turma primeiro", "error")
    return
  }

  let turmaId = Number(turmaSelecionada.turma_id)

  if(!Number.isInteger(turmaId)){
    mostrarToast("Turma inválida", "error")
    return
  }

  try {

    const resultado = await apiPost("/jogos", {
  data: data,
  hora: hora,
  local: local,
  turma_id: turmaId,
  tipo_jogo: tipoJogo
})

    if(!resultado || !resultado.ok){
      mostrarToast(
        resultado?.erro || "Não foi possível criar o jogo.",
        "error"
      )
      return
    }

    const jogoId = resultado.id

    mostrarToast("Jogo criado com sucesso!")

    await carregarJogosAgendados()

    document.getElementById("dataJogo").value = ""
    document.getElementById("horaJogo").value = ""
    document.getElementById("localJogo").value = ""

  } catch(err){

    console.error("ERRO AO CRIAR JOGO:", err)

    mostrarToast(
      "Erro ao criar o jogo.",
      "error"
    )

  }
}

// JOGOS AGENDADOS
async function carregarJogosAgendados(){

  let turmaSelecionada = JSON.parse(
    localStorage.getItem("turmaSelecionada")
  )

  if(!turmaSelecionada){
    console.warn("Nenhuma turma selecionada")
    return
  }

  let turmaId = Number(turmaSelecionada.turma_id)

  try {

    let jogos = await apiGet(`/jogos/${turmaId}`)

    jogosAgendados = jogos
      .filter(jogo => jogo.status === "AGENDADO")
      .sort((a, b) => {

        let dataA = `${a.data}T${a.hora || "00:00:00"}`
        let dataB = `${b.data}T${b.hora || "00:00:00"}`

        return new Date(dataA) - new Date(dataB)
      })

    mostrarJogosAgendados()

  } catch(err){

    console.error("ERRO AO CARREGAR JOGOS AGENDADOS:", err)

  }
}

function mostrarJogosAgendados(){

  let lista = document.getElementById("listaJogosAgendados")

  if(!lista) return

  lista.innerHTML = ""

  if(jogosAgendados.length === 0){

    lista.innerHTML = `
      <div class="historico-card">
        <div class="historico-header">
          <span>📭 Nenhum jogo agendado.</span>
        </div>
      </div>
    `

    return
  }

  for(let jogo of jogosAgendados){

    let dataFormatada = formatarDataBR(jogo.data)

    let horaFormatada = jogo.hora
      ? jogo.hora.substring(0, 5)
      : "--:--"

  lista.innerHTML += `
  <div class="historico-card"
     id="jogo-card-${jogo.id}"
     onclick="abrirJogo(${jogo.id})"
     style="cursor:pointer;">

    <div class="historico-header">

      <div>
        <strong>📅 ${dataFormatada}</strong>
        <span>🕒 ${horaFormatada}</span>
        <span>📍 ${jogo.local}</span>
      </div>

      <span>
  🟡 AGENDADO
  ·
  ${String(jogo.tipo_jogo || "rachao").toLowerCase() === "desafio"
    ? "🔵 DESAFIO"
    : "🟢 RACHÃO"}
</span>

    </div>

  </div>
`
  }
}

async function abrirJogo(jogoId){

  const card = document.getElementById(`jogo-card-${jogoId}`)

  if(!card) return

  // Se já estiver aberto, fecha
  const detalheExistente = document.getElementById(
    `detalhe-jogo-${jogoId}`
  )

  if(detalheExistente){
    detalheExistente.remove()
    return
  }

  try {

    const resultado = await apiGet(
      `/jogos/${jogoId}/presencas`
    )

    const jogo = resultado.jogo
    const presencasJogo = resultado.presencas || []

    const turmaSelecionada = JSON.parse(
      localStorage.getItem("turmaSelecionada")
    )

    const ehJogador =
      turmaSelecionada?.perfil === "JOGADOR"

    const detalhe = document.createElement("div")

    detalhe.id = `detalhe-jogo-${jogoId}`

    detalhe.style.padding = "15px"
    detalhe.style.marginTop = "10px"
    detalhe.style.borderTop = "1px solid #ddd"

    // ==================================================
    // JOGADOR
    // ==================================================

    if(ehJogador){

      const presenca = presencasJogo[0]

      if(!presenca){

        detalhe.innerHTML = `
          <div>
            ⚠️ Sua presença não foi encontrada para este jogo.
          </div>
        `

        card.appendChild(detalhe)

        return
      }

      let respostaTexto = "🟡 Você ainda não respondeu"
      let botoes = ""

      if(presenca.resposta === "CONFIRMADO"){

        respostaTexto = "✅ Você confirmou presença"

      }

      if(presenca.resposta === "RECUSADO"){

        respostaTexto = "❌ Você recusou o convite"

      }

      // Verifica se o prazo ainda está aberto
      let prazoAberto = true

      if(jogo.hora){

        const agora = new Date()

        const dataJogo = new Date(
          `${String(jogo.data).substring(0,10)}T${String(jogo.hora).substring(0,8)}`
        )

        prazoAberto = agora < dataJogo

      }

      if(jogo.status !== "AGENDADO"){

        prazoAberto = false

      }

      if(prazoAberto){

        botoes = `
          <div style="
            display:flex;
            gap:10px;
            flex-wrap:wrap;
            margin-top:15px;
          ">

            <button
              onclick="event.stopPropagation(); responderPresenca(${jogoId}, 'CONFIRMADO')"
              style="
                background:#16a34a;
                color:white;
                border:none;
                padding:10px 16px;
                border-radius:8px;
                cursor:pointer;
              "
            >
              ✅ Confirmar presença
            </button>

            <button
              onclick="event.stopPropagation(); responderPresenca(${jogoId}, 'RECUSADO')"
              style="
                background:#dc2626;
                color:white;
                border:none;
                padding:10px 16px;
                border-radius:8px;
                cursor:pointer;
              "
            >
              ❌ Recusar convite
            </button>

          </div>
        `

      } else {

        botoes = `
          <div style="
            margin-top:15px;
            color:#666;
          ">
            🔒 O prazo para responder este jogo já terminou.
          </div>
        `

      }

      detalhe.innerHTML = `
        <div style="margin-bottom:10px;">

          <strong>
            📅 ${formatarDataBR(jogo.data)}
          </strong>

          <span style="margin-left:10px;">
            🕒 ${jogo.hora
              ? String(jogo.hora).substring(0,5)
              : "--:--"}
          </span>

          <span style="margin-left:10px;">
            📍 ${jogo.local}
          </span>

        </div>

        <div style="
          padding:12px;
          background:#f8fafc;
          border-radius:8px;
        ">

          <strong>${presenca.nome}</strong>

          <div style="margin-top:8px;">
            ${respostaTexto}
          </div>

          ${botoes}

        </div>
      `

      card.appendChild(detalhe)

      return
    }

    // ==================================================
    // ADMIN
    // ==================================================

    const pendentes = presencasJogo.filter(
      p => p.resposta === "PENDENTE"
    ).length

    const confirmados = presencasJogo.filter(
      p => p.resposta === "CONFIRMADO"
    ).length

    const recusados = presencasJogo.filter(
      p => p.resposta === "RECUSADO"
    ).length

    const agora = new Date()

const dataHoraJogo = new Date(
  `${String(jogo.data).substring(0,10)}T${String(jogo.hora).substring(0,8)}`
)

const jogoJaAconteceu = agora >= dataHoraJogo

// ==================================================
// COMPOSIÇÃO AUTOMÁTICA
// ==================================================

let blocoComposicao = ""

const tipoJogo =
  String(jogo.tipo_jogo || "rachao").toLowerCase()


// ==================================================
// RACHÃO → 2 TIMES
// ==================================================

if(tipoJogo === "rachao"){

  const composicao =
    gerarComposicaoEquilibrada(presencasJogo)

  if(composicao){

    blocoComposicao = `
      <div style="
        margin:20px 0;
        padding:15px;
        background:#f8fafc;
        border:1px solid #e2e8f0;
        border-radius:10px;
      ">

        <h4 style="margin-top:0;">
          ⚽ Composição Automática
        </h4>

        <div style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:15px;
        ">

          <div style="
            padding:12px;
            background:white;
            border:1px solid #ddd;
            border-radius:8px;
          ">

            <strong>🔵 Time A</strong>

            <ul style="
              margin:10px 0 0 18px;
              padding:0;
            ">

              ${composicao.timeA.map(j => `
                <li style="margin-bottom:5px;">
                  ${j.nome}

                  <span style="
                    color:#666;
                    font-size:13px;
                  ">
                    (${j.posicao || "Sem posição"})
                  </span>
                </li>
              `).join("")}

            </ul>

          </div>


          <div style="
            padding:12px;
            background:white;
            border:1px solid #ddd;
            border-radius:8px;
          ">

            <strong>🔴 Time B</strong>

            <ul style="
              margin:10px 0 0 18px;
              padding:0;
            ">

              ${composicao.timeB.map(j => `
                <li style="margin-bottom:5px;">
                  ${j.nome}

                  <span style="
                    color:#666;
                    font-size:13px;
                  ">
                    (${j.posicao || "Sem posição"})
                  </span>
                </li>
              `).join("")}

            </ul>

          </div>

        </div>

        <div style="
          margin-top:12px;
          color:#666;
          font-size:13px;
        ">
          Equilíbrio: ${composicao.resultado.total}
        </div>

      </div>
    `
  }

}


// ==================================================
// DESAFIO → 1 TIME
// ==================================================

if(tipoJogo === "desafio"){

  const confirmados =
    presencasJogo.filter(
      p => p.resposta === "CONFIRMADO"
    )

  blocoComposicao = `
    <div style="
      margin:20px 0;
      padding:15px;
      background:#f8fafc;
      border:1px solid #e2e8f0;
      border-radius:10px;
    ">

      <h4 style="margin-top:0;">
        ⚽ Jogadores do Desafio
      </h4>

      ${
        confirmados.length === 0
        ? `
          <div style="color:#666;">
            Nenhum jogador confirmado ainda.
          </div>
        `
        : `
          <div style="
            padding:12px;
            background:white;
            border:1px solid #ddd;
            border-radius:8px;
          ">

            <strong>🔵 Equipe</strong>

            <ul style="
              margin:10px 0 0 18px;
              padding:0;
            ">

              ${confirmados.map(j => `
                <li style="margin-bottom:5px;">
                  ${j.nome}

                  <span style="
                    color:#666;
                    font-size:13px;
                  ">
                    (${j.posicao || "Sem posição"} • ${j.nivel || "Sem nível"})
                  </span>
                </li>
              `).join("")}

            </ul>

          </div>
        `
      }

    </div>
  `
}

    detalhe.innerHTML = `
      <div style="margin-bottom:15px;">

        <strong>
          📅 ${formatarDataBR(jogo.data)}
        </strong>

        <span style="margin-left:10px;">
          🕒 ${jogo.hora
            ? String(jogo.hora).substring(0,5)
            : "--:--"}
        </span>

        <span style="margin-left:10px;">
          📍 ${jogo.local}
        </span>

      </div>

      <div style="
        display:flex;
        gap:15px;
        flex-wrap:wrap;
        margin-bottom:15px;
      ">

        <span>🟡 Pendentes: ${pendentes}</span>
        <span>✅ Confirmados: ${confirmados}</span>
        <span>❌ Recusados: ${recusados}</span>

        <div style="
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  margin-top:15px;
">

  <button
    onclick="event.stopPropagation(); finalizarJogo(${jogoId})"
    ${jogoJaAconteceu ? "" : "disabled"}
    style="
      background:#16a34a;
      color:white;
      border:none;
      padding:10px 16px;
      border-radius:8px;
      cursor:${jogoJaAconteceu ? "pointer" : "not-allowed"};
      opacity:${jogoJaAconteceu ? "1" : "0.5"};
    "
  >
    💾 Salvar Jogo
  </button>

  <button
    onclick="event.stopPropagation(); excluirJogoAgendado(${jogoId})"
    style="
      background:#dc2626;
      color:white;
      border:none;
      padding:10px 16px;
      border-radius:8px;
      cursor:pointer;
    "
  >
    🗑️ Excluir Jogo
  </button>

</div>

      </div>

      ${blocoComposicao}

      <h4>👥 Jogadores</h4>

      <div>

       ${presencasJogo.map(p => {

  let statusTexto =
    p.resposta === "CONFIRMADO"
      ? "✅ Confirmado"
      : p.resposta === "RECUSADO"
        ? "❌ Recusado"
        : "🟡 Pendente"

  let horarioResposta = ""

  if(p.resposta_em){

    let dataResposta =
      String(p.resposta_em).substring(0,10)

    let horaResposta =
      String(p.resposta_em).substring(11,16)

    horarioResposta = `
      <span style="
        margin-left:10px;
        color:#666;
        font-size:13px;
      ">
        📅 ${formatarDataBR(dataResposta)}
        🕒 ${horaResposta}
      </span>
    `
  }

  let botoesAdmin = ""

if(jogo.status === "AGENDADO"){

  botoesAdmin = `
    <div style="
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      margin-top:8px;
    ">

      <button
        onclick="event.stopPropagation(); responderPresenca(${jogoId}, 'CONFIRMADO', ${p.jogador_id})"
        style="
          background:#16a34a;
          color:white;
          border:none;
          padding:6px 10px;
          border-radius:6px;
          cursor:pointer;
        "
      >
        ✅ Confirmar
      </button>

      <button
        onclick="event.stopPropagation(); responderPresenca(${jogoId}, 'RECUSADO', ${p.jogador_id})"
        style="
          background:#dc2626;
          color:white;
          border:none;
          padding:6px 10px;
          border-radius:6px;
          cursor:pointer;
        "
      >
        ❌ Recusar
      </button>

      ${
        p.resposta !== "PENDENTE"
        ? `
          <button
            onclick="event.stopPropagation(); responderPresenca(${jogoId}, 'PENDENTE', ${p.jogador_id})"
            style="
              background:#6b7280;
              color:white;
              border:none;
              padding:6px 10px;
              border-radius:6px;
              cursor:pointer;
            "
          >
            ↩ Pendente
          </button>
        `
        : ""
      }

    </div>
  `
}

  return `

  <div style="
    padding:10px 0;
    border-bottom:1px solid #eee;
  ">

    <div style="
      display:grid;
      grid-template-columns: 380px 130px 170px;
      align-items:center;
      gap:10px;
    ">

      <strong>
        ${p.nome}
      </strong>

      <span>
        ${statusTexto}
      </span>

      <span style="
        color:#666;
        font-size:13px;
      ">
        ${p.resposta_em
          ? `📅 ${formatarDataBR(String(p.resposta_em).substring(0,10))}
             🕒 ${String(p.resposta_em).substring(11,16)}`
          : ""}
      </span>

    </div>

    ${botoesAdmin}

  </div>

`

}).join("")}

      </div>
    `

    card.appendChild(detalhe)

  } catch(err){

    console.error(
      "ERRO AO ABRIR JOGO:",
      err
    )

    mostrarToast(
      "Erro ao abrir o jogo.",
      "error"
    )

  }
}

async function excluirJogoAgendado(jogoId){

  if(!confirm(
    "Deseja realmente excluir este jogo?\n\n" +
    "As respostas de presença também serão excluídas."
  )){
    return
  }

  try {

    const resultado = await apiDelete(
      `/jogos/${jogoId}`
    )

    if(!resultado || !resultado.ok){

      mostrarToast(
        resultado?.erro || "Não foi possível excluir o jogo.",
        "error"
      )

      return
    }

    mostrarToast("Jogo excluído com sucesso!")

    // Fecha qualquer detalhe aberto
    const detalhe = document.getElementById(
      `detalhe-jogo-${jogoId}`
    )

    if(detalhe){
      detalhe.remove()
    }

    // Atualiza a lista de jogos
    await carregarJogosAgendados()

  } catch(err){

    console.error(
      "ERRO AO EXCLUIR JOGO:",
      err
    )

    mostrarToast(
      "Erro ao excluir o jogo.",
      "error"
    )

  }
}

async function responderPresenca(jogoId, resposta, jogadorId = null){

  try {

    const dados = {
      resposta: resposta
    }

    // Quando o ADMIN estiver alterando a resposta
    // de um jogador específico
    if(jogadorId){
      dados.jogador_id = jogadorId
    }

    const resultado = await apiPut(
      `/jogos/${jogoId}/presenca`,
      dados
    )

    if(!resultado || !resultado.ok){

      mostrarToast(
        resultado?.erro ||
        "Não foi possível registrar a resposta.",
        "error"
      )

      return
    }

    mostrarToast(
      resposta === "CONFIRMADO"
        ? "Presença confirmada!"
        : "Convite recusado."
    )

    // Fecha o detalhe atual
    const detalhe = document.getElementById(
      `detalhe-jogo-${jogoId}`
    )

    if(detalhe){
      detalhe.remove()
    }

    // Reabre para mostrar a resposta atualizada
    await abrirJogo(jogoId)

  } catch(err){

    console.error(
      "ERRO AO RESPONDER PRESENÇA:",
      err
    )

    mostrarToast(
      "Erro ao registrar resposta.",
      "error"
    )

  }
}

// ==================================================
// FINALIZAR JOGO
// ==================================================

async function finalizarJogo(jogoId){

  try {

    // Busca novamente os dados atuais do jogo
    const resultado =
      await apiGet(`/jogos/${jogoId}/presencas`)

    const jogo = resultado.jogo
    const presencasJogo = resultado.presencas || []

    // Jogadores confirmados no momento da finalização
    const confirmados =
      presencasJogo.filter(
        p => p.resposta === "CONFIRMADO"
      )

    const presentesReais =
      confirmados.map(
        p => Number(p.jogador_id)
      )

    let composicaoFinal


    // ==============================================
    // DESAFIO
    // ==============================================

    if(
      String(jogo.tipo_jogo || "rachao").toLowerCase()
      === "desafio"
    ){

      composicaoFinal = {
        equipes: {
          1: presentesReais
        }
      }

    }


    // ==============================================
    // RACHÃO
    // ==============================================

    else {

      const composicao =
        gerarComposicaoEquilibrada(
          presencasJogo
        )

      // Menos de 2 confirmados
      if(!composicao){

        composicaoFinal = {
          equipes: {
            1: presentesReais,
            2: []
          }
        }

      } else {

        composicaoFinal = {

          equipes: {

            1: composicao.timeA.map(
              jogador => Number(jogador.jogador_id)
            ),

            2: composicao.timeB.map(
              jogador => Number(jogador.jogador_id)
            )

          }

        }

      }

    }


    // ==============================================
    // ENVIA PARA O BACKEND
    // ==============================================

    const resposta =
      await apiPut(
        `/jogos/${jogoId}/finalizar`,
        {
          presentesReais,
          composicao: composicaoFinal
        }
      )


    if(!resposta || !resposta.ok){

      mostrarToast(
        resposta?.erro ||
        "Não foi possível finalizar o jogo.",
        "error"
      )

      return
    }


    mostrarToast(
      "Jogo finalizado com sucesso!"
    )


    // Atualiza jogos agendados
    await carregarJogosAgendados()

    // Atualiza histórico
    await carregarHistorico()


  } catch(err){

    console.error(
      "ERRO AO FINALIZAR JOGO:",
      err
    )

    mostrarToast(
      "Erro: Existem jogadores Pendentes.",
      "error"
    )

  }

}

// ==================================================
// MOTOR DE EQUILÍBRIO DOS TIMES
// ==================================================

function pesoNivel(nivel){

  const valor = String(nivel || "").toLowerCase()

  if(valor === "ouro") return 3
  if(valor === "prata") return 2
  if(valor === "bronze") return 1

  return 0
}


// --------------------------------------------------
// EMBARALHAR
// --------------------------------------------------

function embaralharJogadores(lista){

  const copia = [...lista]

  for(let i = copia.length - 1; i > 0; i--){

    const j = Math.floor(Math.random() * (i + 1))

    const temp = copia[i]
    copia[i] = copia[j]
    copia[j] = temp

  }

  return copia
}


// --------------------------------------------------
// CONTAR POSIÇÕES
// --------------------------------------------------

function contarPosicoes(time){

  const contagem = {}

  for(const jogador of time){

    const posicao =
      String(jogador.posicao || "").trim()

    // Jogador sem posição não entra
    // no cálculo de equilíbrio das posições.
    if(!posicao){
      continue
    }

    if(!contagem[posicao]){
      contagem[posicao] = 0
    }

    contagem[posicao]++

  }

  return contagem
}


// --------------------------------------------------
// CALCULAR DESEQUILÍBRIO
// --------------------------------------------------

function calcularDesequilibrioTimes(timeA, timeB){

  // ----------------------------------------------
  // QUANTIDADE
  // ----------------------------------------------

  const diferencaQuantidade =
    Math.abs(timeA.length - timeB.length)

  let penalidadeQuantidade = 0

  // Diferença maior que 1 nunca deve acontecer
  if(diferencaQuantidade > 1){
    penalidadeQuantidade = 100000
  }


  // ----------------------------------------------
  // POSIÇÕES
  // ----------------------------------------------

  const posicoesA = contarPosicoes(timeA)
  const posicoesB = contarPosicoes(timeB)

  const todasPosicoes = new Set([
    ...Object.keys(posicoesA),
    ...Object.keys(posicoesB)
  ])

  let penalidadePosicao = 0
  let diferencaPosicoes = 0

  for(const posicao of todasPosicoes){

    const quantidadeA =
      posicoesA[posicao] || 0

    const quantidadeB =
      posicoesB[posicao] || 0

    const diferenca =
      Math.abs(quantidadeA - quantidadeB)

    diferencaPosicoes += diferenca

    // Diferença 1 = 20
    // Diferença 2 = 80
    // Diferença 3 = 180
    penalidadePosicao +=
      (diferenca * diferenca) * 20

  }


  // ----------------------------------------------
  // NÍVEL
  // ----------------------------------------------

  let nivelA = 0
  let nivelB = 0

  for(const jogador of timeA){
    nivelA += pesoNivel(jogador.nivel)
  }

  for(const jogador of timeB){
    nivelB += pesoNivel(jogador.nivel)
  }

  const diferencaNivel =
    Math.abs(nivelA - nivelB)

  const penalidadeNivel =
    (diferencaNivel * diferencaNivel) * 5


  // ----------------------------------------------
  // RESULTADO
  // ----------------------------------------------

  const total =
    penalidadeQuantidade +
    penalidadePosicao +
    penalidadeNivel

  return {

    total,

    quantidade: {
      timeA: timeA.length,
      timeB: timeB.length,
      diferenca: diferencaQuantidade
    },

    posicoes: {
      diferenca: diferencaPosicoes,
      penalidade: penalidadePosicao
    },

    nivel: {
      timeA: nivelA,
      timeB: nivelB,
      diferenca: diferencaNivel,
      penalidade: penalidadeNivel
    }

  }

}


// --------------------------------------------------
// CRIA DIVISÃO INICIAL
// --------------------------------------------------

function criarDivisaoInicial(jogadores){

  const quantidadeA =
    Math.ceil(jogadores.length / 2)

  const quantidadeB =
    Math.floor(jogadores.length / 2)

  let timeA = []
  let timeB = []

  // Embaralha para não repetir sempre a mesma divisão
  const ordem =
    embaralharJogadores(jogadores)

  // Coloca jogadores mais fortes primeiro
  // mantendo alguma aleatoriedade
  ordem.sort((a, b) => {

    const nivelA = pesoNivel(a.nivel)
    const nivelB = pesoNivel(b.nivel)

    return nivelB - nivelA

  })


  for(const jogador of ordem){

    if(timeA.length >= quantidadeA){

      timeB.push(jogador)
      continue

    }

    if(timeB.length >= quantidadeB){

      timeA.push(jogador)
      continue

    }

    const resultadoA =
      calcularDesequilibrioTimes(
        [...timeA, jogador],
        [...timeB]
      )

    const resultadoB =
      calcularDesequilibrioTimes(
        [...timeA],
        [...timeB, jogador]
      )

    if(resultadoA.total <= resultadoB.total){

      timeA.push(jogador)

    } else {

      timeB.push(jogador)

    }

  }

  return {
    timeA,
    timeB
  }

}


// --------------------------------------------------
// MELHORA A DIVISÃO ATRAVÉS DE TROCAS
// --------------------------------------------------

function melhorarDivisao(timeAInicial, timeBInicial){

  let timeA = [...timeAInicial]
  let timeB = [...timeBInicial]

  let atual =
    calcularDesequilibrioTimes(
      timeA,
      timeB
    )

  let melhorou = true
  let tentativas = 0

  while(melhorou && tentativas < 100){

    melhorou = false
    tentativas++

    let melhorTroca = null
    let melhorPontuacao = atual.total


    for(let i = 0; i < timeA.length; i++){

      for(let j = 0; j < timeB.length; j++){

        const novoA = [...timeA]
        const novoB = [...timeB]

        const jogadorA = novoA[i]
        const jogadorB = novoB[j]

        novoA[i] = jogadorB
        novoB[j] = jogadorA

        const resultado =
          calcularDesequilibrioTimes(
            novoA,
            novoB
          )

        if(resultado.total < melhorPontuacao){

          melhorPontuacao = resultado.total

          melhorTroca = {
            timeA: novoA,
            timeB: novoB,
            resultado
          }

        }

      }

    }


    if(melhorTroca){

      timeA = melhorTroca.timeA
      timeB = melhorTroca.timeB
      atual = melhorTroca.resultado

      melhorou = true

    }

  }

  return {
    timeA,
    timeB,
    resultado: atual
  }

}


// --------------------------------------------------
// GERA A MELHOR COMPOSIÇÃO ENCONTRADA
// --------------------------------------------------

function gerarComposicaoEquilibrada(jogadoresConfirmados){

  if(!Array.isArray(jogadoresConfirmados)){
    return null
  }

  if(jogadoresConfirmados.length < 2){
    return null
  }

  const jogadores =
    jogadoresConfirmados.filter(
      jogador =>
        jogador &&
        jogador.resposta === "CONFIRMADO"
    )


  if(jogadores.length < 2){
    return null
  }


  let melhor = null


  // Faz várias tentativas para encontrar
  // uma combinação ainda melhor.
  const quantidadeTentativas =
    Math.min(60, Math.max(20, jogadores.length * 2))


  for(let tentativa = 0;
      tentativa < quantidadeTentativas;
      tentativa++){

    const inicial =
      criarDivisaoInicial(jogadores)

    const resultado =
      melhorarDivisao(
        inicial.timeA,
        inicial.timeB
      )

    if(
      !melhor ||
      resultado.resultado.total < melhor.resultado.total
    ){

      melhor = resultado

    }

  }

  if(!melhor){
    return null
  }

  return {

    timeA: melhor.timeA,
    timeB: melhor.timeB,

    resultado: melhor.resultado

  }

}

// ==================================================
// TESTE TEMPORÁRIO DO MOTOR
// ==================================================

async function testarComposicaoJogo(jogoId){

  try {

    const resultado = await apiGet(
      `/jogos/${jogoId}/presencas`
    )

    const presencasConfirmadas =
      (resultado.presencas || []).filter(
        p => p.resposta === "CONFIRMADO"
      )

    console.log(
      "JOGADORES CONFIRMADOS:",
      presencasConfirmadas
    )

    const composicao =
      gerarComposicaoEquilibrada(
        presencasConfirmadas
      )

    console.log(
      "COMPOSIÇÃO ENCONTRADA:",
      composicao
    )

    return composicao

  } catch(err){

    console.error(
      "ERRO NO TESTE DA COMPOSIÇÃO:",
      err
    )

  }

}

window.testarComposicaoJogo = testarComposicaoJogo

async function carregarHistorico(){

  let turmaSelecionada = JSON.parse(
    localStorage.getItem("turmaSelecionada")
  )

  if(!turmaSelecionada){
    console.warn("Nenhuma turma selecionada")
    return
  }

  let turmaId = Number(turmaSelecionada.turma_id)

  historicoJogos = (await apiGet(`/jogos/${turmaId}`))
  .filter(jogo => jogo.status === "FINALIZADO")

  mostrarHistorico()
}

function mostrarHistorico(){

  let lista = document.getElementById("historicoJogos")

  lista.innerHTML = ""

  historicoJogos.sort(
    (a, b) => new Date(b.data) - new Date(a.data)
  )

  for(let i = historicoJogos.length - 1; i >= 0; i--){

    let jogo = historicoJogos[i]

    let dataFormatada =
      formatarDataBR(jogo.data)

    let composicao =
      Array.isArray(jogo.composicao)
        ? jogo.composicao
        : []

    let tipoJogo =
      String(jogo.tipo_jogo || "rachao").toLowerCase()

    let equipe1 =
      composicao.filter(
        j => Number(j.equipe) === 1
      )

    let equipe2 =
      composicao.filter(
        j => Number(j.equipe) === 2
      )


    // ==================================================
    // COMPOSIÇÃO
    // ==================================================

    let blocoComposicao = ""

    if(composicao.length === 0){

      blocoComposicao = `
        <details>
          <summary style="
            cursor:pointer;
            font-weight:bold;
            padding:8px 0;
          ">
            ⚽ Composição
          </summary>

          <div style="
            margin-top:10px;
            color:#666;
          ">
            Composição não registrada para este jogo.
          </div>
        </details>
      `

    }

    else if(tipoJogo === "desafio"){

      blocoComposicao = `
        <details open>
          <summary style="
            cursor:pointer;
            font-weight:bold;
            padding:8px 0;
          ">
            ⚽ Equipe do Desafio
          </summary>

          <div style="
            margin-top:10px;
            padding:12px;
            background:white;
            border:1px solid #ddd;
            border-radius:8px;
          ">

            <ul style="
              margin:0 0 0 18px;
              padding:0;
            ">

              ${equipe1.map(j => `
                <li style="margin-bottom:5px;">
                  ${j.jogador_nome}

                  <span style="
                    color:#666;
                    font-size:13px;
                  ">
                    (${j.posicao || "Sem posição"})
                  </span>
                </li>
              `).join("")}

            </ul>

          </div>

        </details>
      `

    }

    else {

      blocoComposicao = `
        <details open>

          <summary style="
            cursor:pointer;
            font-weight:bold;
            padding:8px 0;
          ">
            ⚽ Composição do Rachão
          </summary>

          <div style="
            margin-top:10px;
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:15px;
          ">

            <div style="
              padding:12px;
              background:white;
              border:1px solid #ddd;
              border-radius:8px;
            ">

              <strong>🔵 Time A</strong>

              <ul style="
                margin:10px 0 0 18px;
                padding:0;
              ">

                ${equipe1.map(j => `
                  <li style="margin-bottom:5px;">
                    ${j.jogador_nome}

                    <span style="
                      color:#666;
                      font-size:13px;
                    ">
                      (${j.posicao || "Sem posição"})
                    </span>
                  </li>
                `).join("")}

              </ul>

            </div>


            <div style="
              padding:12px;
              background:white;
              border:1px solid #ddd;
              border-radius:8px;
            ">

              <strong>🔴 Time B</strong>

              <ul style="
                margin:10px 0 0 18px;
                padding:0;
              ">

                ${equipe2.map(j => `
                  <li style="margin-bottom:5px;">
                    ${j.jogador_nome}

                    <span style="
                      color:#666;
                      font-size:13px;
                    ">
                      (${j.posicao || "Sem posição"})
                    </span>
                  </li>
                `).join("")}

              </ul>

            </div>

          </div>

        </details>
      `
    }


    // ==================================================
    // HISTÓRICO
    // ==================================================

    lista.innerHTML += `
      <div class="historico-card">

        <div
          class="historico-header"
          onclick="toggleJogo(${i})"
          style="cursor:pointer;"
        >

          <strong>
            📅 ${dataFormatada}
          </strong>

          <span>
  ${
    String(jogo.tipo_jogo || "rachao").toLowerCase() === "desafio"
      ? "🔵 DESAFIO"
      : "🟢 RACHÃO"
  }
</span>

          <span>
            📍 ${jogo.local}
          </span>

          <button
            onclick="event.stopPropagation(); removerJogo(${jogo.id})"
          >
            🗑️
          </button>

        </div>


        <div
          class="historico-body"
          id="jogo-${i}"
          style="display:none;"
        >

          <details>

            <summary style="
              cursor:pointer;
              font-weight:bold;
              padding:8px 0;
            ">
              ✅ Presentes (${jogo.presentes.length})
            </summary>

            <ul style="
              margin:10px 0 10px 18px;
            ">
              ${jogo.presentes
                .map(p => `<li>${p}</li>`)
                .join("")}
            </ul>

          </details>


          <details>

            <summary style="
              cursor:pointer;
              font-weight:bold;
              padding:8px 0;
            ">
              ❌ Faltaram (${jogo.faltaram.length})
            </summary>

            <ul style="
              margin:10px 0 10px 18px;
            ">
              ${jogo.faltaram
                .map(f => `<li>${f}</li>`)
                .join("")}
            </ul>

          </details>


          <div style="
            margin-top:10px;
          ">
            ${blocoComposicao}
          </div>


        </div>

      </div>
    `
  }
}

async function removerJogo(id){

  console.log("CLICOU REMOVER:", id)

  if(!id){
    mostrarToast("ID inválido")
    return
  }

  await apiDelete(`/jogos/${id}`)

  await carregarHistorico()

}

//RANKING//

async function carregarRanking(){

  let turmaSelecionada = JSON.parse(
    localStorage.getItem("turmaSelecionada")
  )

  if(!turmaSelecionada){
    console.warn("Nenhuma turma selecionada")
    return
  }

  let turmaId = Number(turmaSelecionada.turma_id)

  // 🔥 GARANTE QUE HISTÓRICO ESTÁ CARREGADO
  if(historicoJogos.length === 0){
    await carregarHistorico()
  }

  let dados = await apiGet(`/ranking/${turmaId}`)

  console.log("DADOS RANKING:", dados)

  ranking = {}

  for(let i = 0; i < dados.length; i++){
    ranking[dados[i].nome] = dados[i].presencas
  }

  mostrarRanking()
}

function mostrarRanking(){

  let lista = document.getElementById("rankingPresenca")

  if(!lista) return

  lista.innerHTML = ""

  // 🔥 USA O RANKING GLOBAL (DO BACKEND)
  let rankingArray = []

  for(let nome in ranking){
    rankingArray.push({
      nome: nome,
      presencas: ranking[nome]
    })
  }

  rankingArray.sort((a,b) => b.presencas - a.presencas)

 // let limite = mostrarTodosRanking ? rankingArray.length : 3
 let limite = mostrarTodosRanking 
  ? rankingArray.length 
  : Math.min(3, rankingArray.length)

  for(let i=0; i < limite; i++){

    let posicao = i + 1

    let medalha = ""
    if(posicao === 1) medalha = "🥇"
    else if(posicao === 2) medalha = "🥈"
    else if(posicao === 3) medalha = "🥉"

lista.innerHTML += `
  <li class="ranking-item">

    <div class="ranking-header" onclick="toggleRanking(${i})">

      <div class="ranking-left">
        <span class="ranking-pos">${medalha} ${posicao}º</span>
        <span class="ranking-nome">${rankingArray[i].nome}</span>
      </div>

      <div class="ranking-right">
        <span class="ranking-pontos">${rankingArray[i].presencas} jogos</span>
        <button onclick='event.stopPropagation(); removerRanking("${rankingArray[i].nome}")'>🗑️</button>
      </div>

    </div>

    <!-- 🔥 ESCONDIDO POR PADRÃO -->
    <div class="ranking-body" id="ranking-${i}">
      ${gerarGraficoJogador(rankingArray[i].nome)}
    </div>

  </li>
`
  }
if(rankingArray.length > 3){

  lista.innerHTML += `
    <div style="text-align:center; margin-top:10px;">
      <button onclick="toggleRankingLista()" style="padding:8px 16px; border:none; border-radius:8px; cursor:pointer;">
        ${mostrarTodosRanking ? "🔼 Ocultar" : "🔽 Ver mais"}
      </button>
    </div>
  `
}
}

async function removerRanking(nome){

  // 🔥 VALIDA PERMISSÃO PRIMEIRO
  let pode = await usuarioTemPermissao("ranking", "excluir")

  if(!pode){
    mostrarToast("Você não tem autorização para excluir ranking", "error")
    return
  }

  // 🔥 CONFIRMAÇÃO
  if(!confirm("Deseja remover esse jogador do ranking?")) return

  console.log("🗑️ REMOVENDO:", nome)

  await apiDelete(`/ranking/${encodeURIComponent(nome)}`)

  // 🔥 ATUALIZA DO BANCO
  await carregarRanking()
}

async function excluirHistorico(id){

  // 🔥 VALIDA PERMISSÃO
  let pode = await usuarioTemPermissao("historico", "excluir")

  if(!pode){
    mostrarToast("Você não tem autorização para excluir histórico", "error")
    return
  }

  // 🔥 CONFIRMAÇÃO
  if(!confirm("Deseja excluir este histórico?")) return

  await apiDelete(`/jogos/${id}`)

  mostrarToast("Histórico removido com sucesso!")

  // 🔥 ATUALIZA TELA
  await carregarHistorico()
}

function toggleRanking(index){

  let el = document.getElementById("ranking-" + index)

  if(el.style.display === "none" || el.style.display === ""){
    el.style.display = "block"
  } else {
    el.style.display = "none"
  }
}

function gerarGraficoJogador(nome){

  let meses = {}

  for(let jogo of historicoJogos){

    let data = new Date(jogo.data)
    let mes = data.toLocaleString("pt-BR", { month: "short" })

    let presentes = jogo.presentes || []

    if(typeof presentes === "string"){
      try{
        presentes = JSON.parse(presentes)
      }catch{
        presentes = []
      }
    }

    if(!meses[mes]){
      meses[mes] = { total: 0, presencas: 0 }
    }

    meses[mes].total++

    if(presentes.includes(nome)){
      meses[mes].presencas++
    }
  }

  let html = ""

  for(let mes in meses){

    let total = meses[mes].total
    let pres = meses[mes].presencas

    let percentual = total > 0 ? Math.round((pres / total) * 100) : 0

html += `
  <div style="margin-bottom:10px;">
    
    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
      <small>${mes}</small>
      <strong>${percentual}%</strong>
    </div>

    <div class="barra">
      <div class="progresso" style="width:${percentual}%"></div>
    </div>

  </div>
`
  }

  return html
}

async function mostrarSecao(secao){

  // 🔥 BLOQUEIO DE CONFIGURAÇÕES
  if(secao === "configuracoes"){

    let pode = await usuarioTemPermissao("configuracoes", "acessar")

    if(!pode){
      mostrarToast("Sem acesso a configurações", "error")
      return
    }
  }

  // esconde todas
  document.querySelectorAll(".secao").forEach(s => {
    s.style.display = "none"
  })

  // mostra a correta
  let ativa = document.getElementById(secao)

  if(ativa){
    ativa.style.display = "block"
  }

if(secao === "jogos"){

  await carregarJogosAgendados()
}
}

function toggleJogo(index){

  let el = document.getElementById("jogo-" + index)

  if(el.style.display === "none"){
    el.style.display = "block"
  } else {
    el.style.display = "none"
  }
}

function toggleRankingLista(){
  mostrarTodosRanking = !mostrarTodosRanking
  mostrarRanking()
}