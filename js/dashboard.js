function atualizarGraficoMensalidades(){

  const grafico = document.getElementById("graficoMensalidades")

  if(!grafico) return

  const mesAtual = new Date().toLocaleString("pt-BR", {
    month: "long"
  })

  const mesFormatado =
    mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1)

  const jogadoresAtivos = jogadores.filter(
    jogador => jogador.status === "ativo"
  )

  const idsPagaram = new Set(
    pagamentos
      .filter(pagamento => pagamento.mes === mesFormatado)
      .map(pagamento => Number(pagamento.jogador_id))
  )

  const totalAtivos = jogadoresAtivos.length

  const totalPagaram = jogadoresAtivos.filter(
    jogador => idsPagaram.has(Number(jogador.id))
  ).length

  const totalNaoPagaram = totalAtivos - totalPagaram

  const percentualPago = totalAtivos > 0
    ? Math.round((totalPagaram / totalAtivos) * 100)
    : 0

  const percentualNaoPago = 100 - percentualPago

  document.getElementById("mensalidadePagaram").textContent =
    totalPagaram

  document.getElementById("mensalidadeNaoPagaram").textContent =
    totalNaoPagaram

  document.getElementById("mensalidadePercentual").textContent =
    `${percentualPago}%`

  document.getElementById("mensalidadeDescricao").textContent =
    `${mesFormatado} · ${totalAtivos} jogadores ativos`

  grafico.style.background = totalAtivos > 0
    ? `conic-gradient(
        #3478F6 0% ${percentualPago}%,
        #DC4545 ${percentualPago}% 100%
      )`
    : "#E5E7EB"
}


async function atualizarGraficoParticipacoes() {
  const grafico = document.getElementById("graficoParticipacoes")

  if (!grafico) return

  try {
    const turma = JSON.parse(
      localStorage.getItem("turmaSelecionada")
    )

    if (!turma) return

    const dados = await apiGet(
      `/dashboard/${turma.turma_id}/participacoes`
    )

    const totalMensalistas = Number(dados.totalMensalistas) || 0
const totalConvidados = Number(dados.totalConvidados) || 0
const totalParticipacoes = totalMensalistas + totalConvidados
const totalJogos = Number(dados.totalJogos) || 0

    const percentualMensalistas = totalParticipacoes > 0
      ? Math.round((totalMensalistas / totalParticipacoes) * 100)
      : 0

    const percentualConvidados = totalParticipacoes > 0
      ? 100 - percentualMensalistas
      : 0

    const mensalistas = document.getElementById(
      "participacoesMensalistas"
    )

    const convidados = document.getElementById(
      "participacoesConvidados"
    )

    const percentual = document.getElementById(
      "participacoesPercentual"
    )

    const descricao = document.getElementById(
      "participacoesDescricao"
    )

    if (mensalistas) mensalistas.textContent = totalMensalistas
    if (convidados) convidados.textContent = totalConvidados

    if (percentual) {
      percentual.textContent = `${percentualMensalistas}%`
    }

    
if (descricao) {
  descricao.textContent =
    `Últimos 30 dias · ${totalJogos} jogos · ${totalParticipacoes} participações`
}


    grafico.style.background = totalParticipacoes > 0
      ? `conic-gradient(
          #3478F6 0% ${percentualMensalistas}%,
          #DC4545 ${percentualMensalistas}% 100%
        )`
      : "#E5E7EB"

  } catch (erro) {
    console.error("Erro ao atualizar gráfico de participações:", erro)
  }
}
