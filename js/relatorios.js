
async function carregarJogosRelatorioAvaliacao(){

  const turmaSelecionada = JSON.parse(
    localStorage.getItem("turmaSelecionada")
  )

  const select = document.getElementById("selectJogoAvaliacao")
  const resultado = document.getElementById("resultadoRelatorioAvaliacao")

  if(!turmaSelecionada || !select){
    return
  }

  select.innerHTML = '<option value="">Selecione um jogo</option>'
  resultado.innerHTML = ""

  try {

    const turmaId = Number(turmaSelecionada.turma_id)
    const jogos = await apiGet(`/jogos/${turmaId}`)

    const jogosFinalizados = jogos
      .filter(jogo => jogo.status === "FINALIZADO")
      .sort((a, b) => {
        const dataA = `${a.data}T${a.hora || "00:00:00"}`
        const dataB = `${b.data}T${b.hora || "00:00:00"}`

        return new Date(dataB) - new Date(dataA)
      })

    jogosFinalizados.forEach(jogo => {

      const data = jogo.data
        ? new Date(jogo.data).toLocaleDateString("pt-BR")
        : "Sem data"

      const option = document.createElement("option")

      option.value = jogo.jogo_id || jogo.id
      option.textContent =
        `${data} — ${jogo.local || "Local não informado"}`

      select.appendChild(option)
    })

    if(jogosFinalizados.length === 0){
      resultado.innerHTML =
        "<p>Nenhum jogo finalizado encontrado.</p>"
    }

  } catch(err) {

    console.error("Erro ao carregar jogos para relatório:", err)

    mostrarToast("Erro ao carregar jogos do relatório.", "error")
  }
}

async function carregarRelatorioAvaliacao(){

  const jogoId = document.getElementById("selectJogoAvaliacao").value
  const resultado = document.getElementById("resultadoRelatorioAvaliacao")

  if(!jogoId){
    mostrarToast("Selecione um jogo primeiro.", "error")
    return
  }

  resultado.innerHTML = "<p>Carregando avaliações...</p>"

  try {

    const avaliacoes = await apiGet(`/avaliacoes/${jogoId}`)
    window.avaliacoesRelatorioPDF = avaliacoes

    if(!Array.isArray(avaliacoes)){
      throw new Error(
        avaliacoes?.erro || "Resposta inválida do servidor."
      )
    }

    if(avaliacoes.length === 0){
      resultado.innerHTML = `
        <div class="card">
          <h3>📊 Resultado das avaliações</h3>
          <p>Nenhum jogador avaliou este jogo ainda.</p>
        </div>
      `
      return
    }

    const criterios = [
      ["nota_equipe", "Equipe"],
      ["nota_defesa", "Defesa"],
      ["nota_ataque", "Ataque"],
      ["nota_organizacao", "Organização"],
      ["nota_adversario", "Adversário"],
      ["nota_nivel_jogo", "Nível do jogo"]
    ]

    const media = campo =>
      (
        avaliacoes.reduce(
          (soma, avaliacao) => soma + Number(avaliacao[campo] || 0),
          0
        ) / avaliacoes.length
      ).toFixed(1).replace(".", ",")

        const mediaGeral = (
      criterios.reduce((soma, [campo]) => {
        return soma + avaliacoes.reduce(
          (total, a) => total + Number(a[campo] || 0),
          0
        ) / avaliacoes.length;
      }, 0) / criterios.length
    );

    resultado.innerHTML = `
      <div style="display:grid;gap:16px;margin-top:16px;">

        <!-- RESUMO -->
        <div class="card" style="padding:20px;">

          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            flex-wrap:wrap;
            gap:16px;
            margin-bottom:20px;
          ">
            <div>
              <h3 style="margin:0 0 6px;">📊 Resultado das avaliações</h3>
              <p style="margin:0;color:#64748b;font-size:13px;">
                Resumo da avaliação da partida
              </p>
            </div>

            <button
              type="button"
              onclick="exportarAvaliacaoPDF()"
            >
              📄 Salvar em PDF
            </button>
          </div>

          <div style="
            display:grid;
            grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
            gap:12px;
            margin-bottom:24px;
          ">
            <div style="padding:16px;background:#f1f5f9;border-radius:12px;">
              <p style="margin:0 0 6px;color:#64748b;font-size:13px;">
                Total de avaliações
              </p>
              <strong style="font-size:26px;color:#1d4ed8;">
                ${avaliacoes.length}
              </strong>
            </div>

            <div style="padding:16px;background:#f1f5f9;border-radius:12px;">
              <p style="margin:0 0 6px;color:#64748b;font-size:13px;">
                Média geral
              </p>
              <strong style="font-size:26px;color:#1d4ed8;">
                ${mediaGeral.toFixed(1).replace(".", ",")}
                <span style="font-size:14px;color:#64748b;">/ 5</span>
              </strong>
            </div>
          </div>

          <h4 style="margin:0 0 16px;">Médias por critério</h4>

          <div style="
            display:grid;
            grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
            gap:18px 24px;
          ">
            ${criterios.map(([campo, nome]) => {
              const valor = avaliacoes.reduce(
                (soma, a) => soma + Number(a[campo] || 0),
                0
              ) / avaliacoes.length;

              const percentual = Math.max(0, Math.min(100, valor / 5 * 100));

              return `
                <div>
                  <div style="
                    display:flex;
                    justify-content:space-between;
                    gap:10px;
                    margin-bottom:8px;
                  ">
                    <span style="font-size:14px;">${nome}</span>
                    <strong style="font-size:14px;white-space:nowrap;">
                      ${valor.toFixed(1).replace(".", ",")} / 5
                    </strong>
                  </div>

                  <div style="
                    height:7px;
                    background:#e2e8f0;
                    border-radius:10px;
                    overflow:hidden;
                  ">
                    <div style="
                      height:100%;
                      width:${percentual}%;
                      background:#2563eb;
                      border-radius:10px;
                    "></div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>

        </div>

        <!-- AVALIAÇÕES INDIVIDUAIS -->
        <div class="card" style="padding:20px;">

          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            flex-wrap:wrap;
            gap:8px;
            margin-bottom:12px;
          ">
            <div>
              <h3 style="margin:0 0 5px;">👥 Avaliações por jogador</h3>
              <p style="margin:0;color:#64748b;font-size:13px;">
                Selecione um jogador para consultar as respostas.
              </p>
            </div>

            <span style="
              background:#eff6ff;
              color:#1d4ed8;
              border-radius:20px;
              padding:6px 10px;
              font-size:12px;
              font-weight:600;
            ">
              ${avaliacoes.length} ${avaliacoes.length === 1 ? "avaliação" : "avaliações"}
            </span>
          </div>

          ${avaliacoes.map((a, index) => `
            <div style="border-top:1px solid #e2e8f0;">

              <div
                role="button"
                tabindex="0"
                onclick="toggleAvaliacaoJogador(${index})"
                onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleAvaliacaoJogador(${index})}"
                style="
                  display:flex;
                  justify-content:space-between;
                  align-items:center;
                  gap:12px;
                  padding:15px 4px;
                  cursor:pointer;
                "
              >
                <div style="display:flex;align-items:center;gap:12px;">
                  <div style="
                    width:36px;
                    height:36px;
                    flex-shrink:0;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    border-radius:50%;
                    background:#eff6ff;
                    color:#2563eb;
                    font-weight:700;
                  ">
                    ${(a.jogador_nome || "J").trim().charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <strong style="display:block;">
                      ${a.jogador_nome || "Jogador"}
                    </strong>
                    <span style="font-size:12px;color:#64748b;">
                      Ver notas e comentário
                    </span>
                  </div>
                </div>

                <span
                  id="setaAvaliacaoJogador${index}"
                  style="color:#64748b;"
                >▼</span>
              </div>

              <div
                id="conteudoAvaliacaoJogador${index}"
                style="display:none;padding:0 4px 18px 52px;"
              >
                <div style="
                  display:grid;
                  grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
                  gap:10px;
                  margin-bottom:14px;
                ">
                  ${criterios.map(([campo, nome]) => `
                    <div style="
                      padding:12px;
                      background:#f8fafc;
                      border:1px solid #e2e8f0;
                      border-radius:10px;
                    ">
                      <span style="display:block;color:#64748b;font-size:12px;margin-bottom:5px;">
                        ${nome}
                      </span>
                      <strong>${Number(a[campo]) || 0}/5</strong>
                    </div>
                  `).join("")}
                </div>

                <div style="
                  padding:12px 14px;
                  background:#f8fafc;
                  border-left:3px solid #2563eb;
                  border-radius:6px;
                ">
                  <strong style="font-size:13px;">Comentário</strong>
                  <p style="margin:6px 0 0;line-height:1.6;">
                    ${a.comentario || "Sem comentário."}
                  </p>
                </div>
              </div>

            </div>
          `).join("")}

        </div>
      </div>
    `

  } catch(err) {

    console.error("Erro ao carregar relatório:", err)

    resultado.innerHTML = `
      <div class="card">
        <p>Não foi possível carregar as avaliações.</p>
        <p>${err.message || "Erro desconhecido."}</p>
      </div>
    `

  }

}

function exportarAvaliacaoPDF() {
  const avaliacoes = window.avaliacoesRelatorioPDF;

  if (!Array.isArray(avaliacoes) || avaliacoes.length === 0) {
    mostrarToast("Não há avaliações para exportar.", "error");
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    mostrarToast("A biblioteca de PDF não está disponível.", "error");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const criterios = [
    ["nota_equipe", "Equipe"],
    ["nota_defesa", "Defesa"],
    ["nota_ataque", "Ataque"],
    ["nota_organizacao", "Organização"],
    ["nota_adversario", "Adversário"],
    ["nota_nivel_jogo", "Nível do jogo"]
  ];

  const azul = [37, 99, 235];
  const azulClaro = [239, 246, 255];
  const cinza = [100, 116, 139];
  const texto = [30, 41, 59];
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const margem = 15;
  const larguraUtil = largura - margem * 2;

  const mediaGeral = criterios.reduce((soma, [campo]) => {
    return soma + avaliacoes.reduce(
      (total, a) => total + Number(a[campo] || 0),
      0
    ) / avaliacoes.length;
  }, 0) / criterios.length;

  const formatarNota = valor =>
    Number(valor).toFixed(1).replace(".", ",");

  let y = 20;

  // Cabeçalho
  doc.setFillColor(...azul);
  doc.rect(0, 0, largura, 38, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Relatório de avaliações", margem, 17);

  doc.setFont("helvetica", "normal");
doc.setFontSize(10);
doc.text("SYNGEST - Gestão Esportiva | Avaliação dos jogos", margem, 26);

  doc.setFontSize(9);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    largura - margem,
    33,
    { align: "right" }
  );

  y = 49;

  // Cartões de resumo
  const espacamento = 5;
  const larguraCartao = (larguraUtil - espacamento) / 2;

  doc.setFillColor(...azulClaro);
  doc.roundedRect(margem, y, larguraCartao, 25, 3, 3, "F");
  doc.roundedRect(
    margem + larguraCartao + espacamento,
    y,
    larguraCartao,
    25,
    3,
    3,
    "F"
  );

  doc.setTextColor(...cinza);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("TOTAL DE AVALIAÇÕES", margem + 5, y + 8);
  doc.text(
    "MÉDIA GERAL",
    margem + larguraCartao + espacamento + 5,
    y + 8
  );

  doc.setTextColor(...azul);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(String(avaliacoes.length), margem + 5, y + 19);
  doc.text(
    `${formatarNota(mediaGeral)} / 5`,
    margem + larguraCartao + espacamento + 5,
    y + 19
  );

  y += 37;

  // Médias por critério
  doc.setTextColor(...texto);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Médias por critério", margem, y);
  y += 9;

  const colunas = 2;
  const larguraColuna = (larguraUtil - 8) / colunas;

  criterios.forEach(([campo, nome], index) => {
    const coluna = index % colunas;
    const linha = Math.floor(index / colunas);
    const x = margem + coluna * (larguraColuna + 8);
    const yItem = y + linha * 18;

    const media = avaliacoes.reduce(
      (soma, a) => soma + Number(a[campo] || 0),
      0
    ) / avaliacoes.length;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...texto);
    doc.text(nome, x, yItem);

    doc.setFont("helvetica", "bold");
    doc.text(
      `${formatarNota(media)} / 5`,
      x + larguraColuna,
      yItem,
      { align: "right" }
    );

    doc.setFillColor(226, 232, 240);
    doc.roundedRect(x, yItem + 3, larguraColuna, 2, 1, 1, "F");

    doc.setFillColor(...azul);
    doc.roundedRect(
      x,
      yItem + 3,
      larguraColuna * Math.max(0, Math.min(5, media)) / 5,
      2,
      1,
      1,
      "F"
    );
  });

  y += Math.ceil(criterios.length / colunas) * 18 + 8;

  // Avaliações individuais
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...texto);
  doc.text("Avaliações por jogador", margem, y);
  y += 8;

  avaliacoes.forEach((a, index) => {
    const nome = a.jogador_nome || "Jogador";
    const comentario = String(a.comentario || "Sem comentário");

    const linhasComentario = doc.splitTextToSize(
      comentario,
      larguraUtil - 12
    );

    const alturaCartao = 30 + linhasComentario.length * 5;

    if (y + alturaCartao > altura - 15) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(
      margem,
      y,
      larguraUtil,
      alturaCartao,
      3,
      3,
      "F"
    );

    doc.setFillColor(...azul);
    doc.roundedRect(margem, y, 2, alturaCartao, 1, 1, "F");

    doc.setTextColor(...azul);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(nome, margem + 7, y + 8);

    doc.setTextColor(...texto);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    let yNota = y + 16;

    criterios.forEach(([campo, criterio]) => {
      doc.text(
        `${criterio}: ${Number(a[campo]) || 0}/5`,
        margem + 7,
        yNota
      );
      yNota += 5;
    });

    yNota += 2;

    doc.setFont("helvetica", "bold");
    doc.text("Comentário:", margem + 7, yNota);

    doc.setFont("helvetica", "normal");
    doc.text(linhasComentario, margem + 7, yNota + 5);

    y += alturaCartao + 5;
  });

  // Numeração das páginas
  const totalPaginas = doc.internal.getNumberOfPages();

  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...cinza);

    doc.text(
      `SYNGEST - Gestão Esportiva | Página ${pagina} de ${totalPaginas}`,
      largura / 2,
      altura - 7,
      { align: "center" }
    );
  }

  doc.save("relatorio-avaliacoes-gew-sports.pdf");
}

async function carregarRankingAvaliacoes(){

  const turmaSelecionada = JSON.parse(
    localStorage.getItem("turmaSelecionada")
  )

  const resultado = document.getElementById("rankingAvaliacoes")
  const dataInicial = document.getElementById("dataInicialRelatorio").value
  const dataFinal = document.getElementById("dataFinalRelatorio").value
  const ordenacao = document.getElementById("ordenacaoRelatorio").value

  if(!turmaSelecionada){
    resultado.innerHTML = "<p>Nenhuma turma selecionada.</p>"
    return
  }

  if(dataInicial && dataFinal && dataInicial > dataFinal){
    mostrarToast("A data inicial não pode ser posterior à data final.", "error")
    return
  }

  resultado.innerHTML = "<p>Carregando ranking...</p>"

  try {

    const turmaId = Number(turmaSelecionada.turma_id)

    const jogos = await apiGet(
      `/avaliacoes/ranking/${turmaId}`
    )

    if(!Array.isArray(jogos)){
      throw new Error(
        jogos?.erro || "Resposta inválida do servidor."
      )
    }

    const filtrarPorData = jogos.filter(jogo => {

      if(!jogo.data) return !dataInicial && !dataFinal

      const dataJogo = String(jogo.data).slice(0, 10)

      if(dataInicial && dataJogo < dataInicial) return false
      if(dataFinal && dataJogo > dataFinal) return false

      return true
    })

    filtrarPorData.sort((a, b) => {

      if(ordenacao === "melhor"){
        return Number(b.media_geral) - Number(a.media_geral)
      }

      if(ordenacao === "pior"){
        return Number(a.media_geral) - Number(b.media_geral)
      }

      const dataA = String(a.data || "")
      const dataB = String(b.data || "")

      if(ordenacao === "antigo"){
        return dataA.localeCompare(dataB)
      }

      return dataB.localeCompare(dataA)
    })

    window.rankingJogosRelatorioPDF = filtrarPorData;
    window.filtrosRankingRelatorioPDF = {
    dataInicial,
    dataFinal,
    ordenacao
    };

    if(filtrarPorData.length === 0){
      resultado.innerHTML = `
        <div class="card">
          <p>Nenhum jogo avaliado encontrado para os filtros selecionados.</p>
        </div>
      `
      return
    }

    resultado.innerHTML = `
      <div class="card">
                <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
          flex-wrap:wrap;
        ">
          <div>
            <h3>🏆 Ranking dos jogos</h3>
            <p>Total de partidas avaliadas: <strong>${filtrarPorData.length}</strong></p>
          </div>

          <button
            type="button"
            onclick="exportarRankingJogosPDF()"
          >
            📄 Salvar em PDF
          </button>
        </div>

        ${filtrarPorData.map((jogo, index) => {

          const media = Number(jogo.media_geral || 0)
          const percentual = Math.max(0, Math.min(100, media / 5 * 100))

          const dataFormatada = jogo.data
            ? new Date(String(jogo.data).slice(0, 10) + "T12:00:00")
                .toLocaleDateString("pt-BR")
            : "Sem data"

          return `
            <div style="
              padding:16px 0;
              border-bottom:1px solid #e2e8f0;
            ">

              <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:12px;
                flex-wrap:wrap;
              ">

                <div>
                  <strong>${index + 1}º — ${jogo.local || "Local não informado"}</strong>
                  <p style="margin:5px 0;color:#64748b;font-size:13px;">
                    📅 ${dataFormatada}
                  </p>
                </div>

                <div style="text-align:right;">
                  <strong style="color:#2563eb;font-size:20px;">
                    ${media.toFixed(2).replace(".", ",")}/5
                  </strong>
                  <p style="margin:4px 0;color:#64748b;font-size:12px;">
                    ${jogo.total_avaliacoes} avaliação(ões)
                  </p>
                </div>

              </div>

              <div style="
                height:7px;
                margin-top:12px;
                background:#e2e8f0;
                border-radius:10px;
                overflow:hidden;
              ">
                <div style="
                  height:100%;
                  width:${percentual}%;
                  background:#2563eb;
                  border-radius:10px;
                "></div>
              </div>

            </div>
          `

        }).join("")}

      </div>
    `

  } catch(err) {

    console.error("Erro ao carregar ranking:", err)

    resultado.innerHTML = `
      <div class="card">
        <p>Não foi possível carregar o ranking.</p>
        <p>${err.message || "Erro desconhecido."}</p>
      </div>
    `

  }

}

function gerarRelatorioReceitas() {
  const resultado = document.getElementById("resultadoRelatorioReceitas");
  const dataInicial = document.getElementById("dataInicialReceitas").value;
  const dataFinal = document.getElementById("dataFinalReceitas").value;

  if (dataInicial && dataFinal && dataInicial > dataFinal) {
    mostrarToast("A data inicial não pode ser posterior à data final.");
    return;
  }

  const movimentos = [];

  function adicionarMovimento(item, origem, descricao) {
    if (!item.data) return;

    const data = String(item.data).slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
    if (dataInicial && data < dataInicial) return;
    if (dataFinal && data > dataFinal) return;

    movimentos.push({
      data,
      origem,
      descricao,
      valor: Number(item.valor) || 0
    });
  }

  pagamentos.forEach(p => {
    adicionarMovimento(
      p,
      "Mensalidade",
      p.jogador_nome || p.jogador || "Pagamento"
    );
  });

  receitas.forEach(r => {
    adicionarMovimento(
      r,
      "Outra receita",
      r.descricao || "Receita"
    );
  });

  movimentos.sort((a, b) => b.data.localeCompare(a.data));

  const total = movimentos.reduce((soma, item) => soma + item.valor, 0);

  
const totaisMensais = {};

movimentos.forEach(item => {
  const mes = item.data.slice(0, 7);

  totaisMensais[mes] = (totaisMensais[mes] || 0) + item.valor;
});

const resumoMensal = document.createElement("div");
resumoMensal.className = "card";
resumoMensal.style.marginTop = "16px";
resumoMensal.style.padding = "16px";

const tituloMensal = document.createElement("h3");
tituloMensal.textContent = "Total de receitas por mês";
tituloMensal.style.marginTop = "0";

resumoMensal.appendChild(tituloMensal);

const mesesOrdenados = Object.keys(totaisMensais).sort();

if (mesesOrdenados.length === 0) {
  const mensagemMensal = document.createElement("p");
  mensagemMensal.textContent = "Nenhuma receita encontrada no período.";
  resumoMensal.appendChild(mensagemMensal);
} else {
  mesesOrdenados.forEach(mes => {
    const [ano, numeroMes] = mes.split("-");
    const nomeMes = new Date(
      Number(ano),
      Number(numeroMes) - 1,
      1
    ).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric"
    });

    const linha = document.createElement("div");
    linha.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #e2e8f0;
    `;

    const nome = document.createElement("span");
    nome.textContent =
      nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

    const valor = document.createElement("strong");
    valor.textContent = formatarMoeda(totaisMensais[mes]);
    valor.style.whiteSpace = "nowrap";

    linha.append(nome, valor);
    resumoMensal.appendChild(linha);
  });
}

  resultado.style.display = "block";
  resultado.innerHTML = "";

  const resumo = document.createElement("div");
  resumo.className = "card";
  resumo.style.marginTop = "16px";
  resumo.style.padding = "16px";

  const titulo = document.createElement("h3");
  titulo.textContent = "Total de receitas no período";

  const valorTotal = document.createElement("strong");
  valorTotal.textContent = formatarMoeda(total);
  valorTotal.style.fontSize = "1.4rem";

  resumo.append(titulo, valorTotal);
    resultado.appendChild(resumo);
    resultado.appendChild(resumoMensal);

  const turmaSelecionada = JSON.parse(
  localStorage.getItem("turmaSelecionada") || "null"
);

window.receitasRelatorioPDF = {
  movimentos,
  dataInicial,
  dataFinal,
  total,
  totalRegistros: movimentos.length,
  nomeTurma: turmaSelecionada?.nome || turmaSelecionada?.turma_nome || "Turma não identificada"
};

const botaoPDF = document.createElement("button");
botaoPDF.type = "button";
botaoPDF.textContent = "📄 Salvar em PDF";
botaoPDF.style.display = "block";
botaoPDF.style.marginTop = "14px";
botaoPDF.onclick = exportarReceitasPDF;

resumo.appendChild(botaoPDF);

  if (movimentos.length === 0) {
    const mensagem = document.createElement("p");
    mensagem.textContent = "Nenhuma receita encontrada no período selecionado.";
    resultado.appendChild(mensagem);
    return;
  }

  const tabela = document.createElement("table");
  tabela.style.width = "100%";
  tabela.style.marginTop = "16px";

  const cabecalho = document.createElement("thead");
  cabecalho.innerHTML = `
    <tr>
      <th>Data</th>
      <th>Descrição</th>
      <th>Tipo</th>
      <th>Valor</th>
    </tr>
  `;

  const corpo = document.createElement("tbody");

  movimentos.forEach(item => {
    const linha = document.createElement("tr");

    const data = item.data.split("-");
    const dataFormatada = `${data[2]}/${data[1]}/${data[0]}`;

    [
      dataFormatada,
      item.descricao,
      item.origem,
      formatarMoeda(item.valor)
    ].forEach((texto, indice) => {
      const celula = document.createElement("td");
      celula.textContent = texto;

      if (indice === 3) {
        celula.style.whiteSpace = "nowrap";
      }

      linha.appendChild(celula);
    });

    corpo.appendChild(linha);
  });

  tabela.append(cabecalho, corpo);
  resultado.appendChild(tabela);
}

function gerarRelatorioDespesas() {
  const resultado = document.getElementById("resultadoRelatorioDespesas");
  const dataInicial = document.getElementById("dataInicialDespesasRelatorio").value;
  const dataFinal = document.getElementById("dataFinalDespesasRelatorio").value;

  if (dataInicial && dataFinal && dataInicial > dataFinal) {
    mostrarToast("A data inicial não pode ser posterior à data final.");
    return;
  }

  const movimentos = [];

  despesas.forEach(d => {
    if (!d.data) return;

    const dataOriginal = String(d.data);
    let data;

    if (/^\d{4}-\d{2}-\d{2}/.test(dataOriginal)) {
      data = dataOriginal.slice(0, 10);
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataOriginal)) {
      const [dia, mes, ano] = dataOriginal.split("/");
      data = `${ano}-${mes}-${dia}`;
    } else {
      return;
    }

    if (dataInicial && data < dataInicial) return;
    if (dataFinal && data > dataFinal) return;

    movimentos.push({
      data,
      descricao: d.descricao || "Despesa",
      valor: Number(d.valor) || 0
    });
  });

  movimentos.sort((a, b) => b.data.localeCompare(a.data));

  const total = movimentos.reduce(
    (soma, item) => soma + item.valor,
    0
  );

  const turmaSelecionada = JSON.parse(
  localStorage.getItem("turmaSelecionada") || "null"
);

window.despesasRelatorioPDF = {
  movimentos,
  dataInicial,
  dataFinal,
  total,
  totalRegistros: movimentos.length,
  nomeTurma:
    turmaSelecionada?.nome ||
    turmaSelecionada?.turma_nome ||
    "Turma não identificada"
};

  resultado.style.display = "block";
  resultado.innerHTML = "";

  const resumo = document.createElement("div");
  resumo.className = "card";
  resumo.style.marginTop = "16px";
  resumo.style.padding = "16px";

  const titulo = document.createElement("h3");
  titulo.textContent = "Total de despesas no período";

  const valorTotal = document.createElement("strong");
  valorTotal.textContent = formatarMoeda(total);
  valorTotal.style.fontSize = "1.4rem";

  resumo.append(titulo, valorTotal);
  resultado.appendChild(resumo);

  const botaoPDF = document.createElement("button");
botaoPDF.type = "button";
botaoPDF.textContent = "📄 Salvar em PDF";
botaoPDF.style.display = "block";
botaoPDF.style.marginTop = "14px";
botaoPDF.onclick = exportarDespesasPDF;

resumo.appendChild(botaoPDF);

  if (movimentos.length === 0) {
    const mensagem = document.createElement("p");
    mensagem.textContent = "Nenhuma despesa encontrada no período.";
    resultado.appendChild(mensagem);
    return;
  }

  const tabela = document.createElement("table");
  tabela.style.width = "100%";
  tabela.style.marginTop = "16px";

  const cabecalho = document.createElement("thead");
  cabecalho.innerHTML = `
    <tr>
      <th>Data</th>
      <th>Descrição</th>
      <th>Valor</th>
    </tr>
  `;

  const corpo = document.createElement("tbody");

  movimentos.forEach(item => {
    const linha = document.createElement("tr");
    const [ano, mes, dia] = item.data.split("-");
    const dataFormatada = `${dia}/${mes}/${ano}`;

    [dataFormatada, item.descricao, formatarMoeda(item.valor)]
      .forEach(texto => {
        const celula = document.createElement("td");
        celula.textContent = texto;
        linha.appendChild(celula);
      });

    corpo.appendChild(linha);
  });

  tabela.append(cabecalho, corpo);
  resultado.appendChild(tabela);
}

function gerarRelatorioResultadoPeriodo() {
  const resultado = document.getElementById("resultadoRelatorioPeriodo");
  const dataInicial = document.getElementById("dataInicialResultadoPeriodo").value;
  const dataFinal = document.getElementById("dataFinalResultadoPeriodo").value;

  if (dataInicial && dataFinal && dataInicial > dataFinal) {
    mostrarToast("A data inicial não pode ser posterior à data final.", "error");
    return;
  }

  const movimentos = [];

  function normalizarData(valor) {
    if (!valor) return null;

    const texto = String(valor).trim();

    if (/^\d{4}-\d{2}-\d{2}/.test(texto)) {
      return texto.slice(0, 10);
    }

    const brasileira = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

    if (brasileira) {
      return `${brasileira[3]}-${brasileira[2]}-${brasileira[1]}`;
    }

    return null;
  }

  function adicionarMovimento(item, tipo, descricao) {
    const data = normalizarData(item.data);

    if (!data) return;
    if (dataInicial && data < dataInicial) return;
    if (dataFinal && data > dataFinal) return;

    movimentos.push({
      data,
      tipo,
      descricao,
      valor: Number(item.valor) || 0
    });
  }

  // Mensalidades recebidas
  pagamentos.forEach(p => {
    adicionarMovimento(
      p,
      "Receita",
      p.jogador_nome || p.jogador || "Mensalidade"
    );
  });

  // Outras receitas
  receitas.forEach(r => {
    adicionarMovimento(
      r,
      "Receita",
      r.descricao || "Outra receita"
    );
  });

  // Despesas
  despesas.forEach(d => {
    adicionarMovimento(
      d,
      "Despesa",
      d.descricao || "Despesa"
    );
  });

  movimentos.sort((a, b) => b.data.localeCompare(a.data));

  const totalReceitas = movimentos
    .filter(m => m.tipo === "Receita")
    .reduce((soma, m) => soma + m.valor, 0);

  const totalDespesas = movimentos
    .filter(m => m.tipo === "Despesa")
    .reduce((soma, m) => soma + m.valor, 0);

  const saldo = totalReceitas - totalDespesas;
  
const turmaSelecionada = JSON.parse(
  localStorage.getItem("turmaSelecionada") || "null"
);

window.resultadoPeriodoRelatorioPDF = {
  movimentos,
  dataInicial,
  dataFinal,
  totalReceitas,
  totalDespesas,
  saldo,
  totalRegistros: movimentos.length,
  nomeTurma:
    turmaSelecionada?.nome ||
    turmaSelecionada?.turma_nome ||
    "Turma não identificada"
};

  resultado.style.display = "block";
  resultado.innerHTML = "";

  const resumo = document.createElement("div");
  resumo.className = "card";
  resumo.style.marginTop = "16px";

  resumo.innerHTML = `
    <h3>📊 Resultado financeiro do período</h3>

    <div class="filtros-relatorio">
      <div>
        <p>Total de receitas</p>
        <strong style="color:#16a34a;font-size:1.2rem">
          ${formatarMoeda(totalReceitas)}
        </strong>
      </div>

      <div>
        <p>Total de despesas</p>
        <strong style="color:#dc2626;font-size:1.2rem">
          ${formatarMoeda(totalDespesas)}
        </strong>
      </div>

      <div>
        <p>Saldo do período</p>
        <strong style="color:${saldo >= 0 ? "#16a34a" : "#dc2626"};font-size:1.2rem">
          ${formatarMoeda(saldo)}
        </strong>
      </div>
    </div>
  `;

  resultado.appendChild(resumo);
  
const botaoPDF = document.createElement("button");
botaoPDF.type = "button";
botaoPDF.textContent = "📄 Salvar em PDF";
botaoPDF.style.display = "block";
botaoPDF.style.marginTop = "14px";
botaoPDF.onclick = exportarResultadoPeriodoPDF;

resumo.appendChild(botaoPDF);

  if (movimentos.length === 0) {
    const mensagem = document.createElement("p");
    mensagem.textContent = "Nenhuma movimentação encontrada no período selecionado.";
    resultado.appendChild(mensagem);
    return;
  }

  const tabela = document.createElement("table");
  tabela.style.width = "100%";
  tabela.style.marginTop = "16px";

  tabela.innerHTML = `
    <thead>
      <tr>
        <th>Data</th>
        <th>Descrição</th>
        <th>Tipo</th>
        <th>Valor</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const corpo = tabela.querySelector("tbody");

  movimentos.forEach(item => {
    const linha = document.createElement("tr");
    const [ano, mes, dia] = item.data.split("-");
    const dataFormatada = `${dia}/${mes}/${ano}`;

    [
      dataFormatada,
      item.descricao,
      item.tipo,
      formatarMoeda(item.valor)
    ].forEach((texto, indice) => {
      const celula = document.createElement("td");
      celula.textContent = texto;

      if (indice === 2) {
        celula.style.color =
          item.tipo === "Receita" ? "#16a34a" : "#dc2626";
      }

      linha.appendChild(celula);
    });

    corpo.appendChild(linha);
  });

  resultado.appendChild(tabela);
}

function toggleAvaliacaoJogador(index) {
  const conteudo = document.getElementById(
    `conteudoAvaliacaoJogador${index}`
  );

  const seta = document.getElementById(
    `setaAvaliacaoJogador${index}`
  );

  if (!conteudo || !seta) return;

  const vaiAbrir = conteudo.style.display === "none";

  conteudo.style.display = vaiAbrir ? "block" : "none";
  seta.textContent = vaiAbrir ? "▲" : "▼";
}

function exportarRankingJogosPDF() {
  const jogos = window.rankingJogosRelatorioPDF;
  const filtros = window.filtrosRankingRelatorioPDF || {};

  if (!Array.isArray(jogos) || jogos.length === 0) {
    mostrarToast("Não há jogos para exportar.", "error");
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    mostrarToast("A biblioteca de PDF não está disponível.", "error");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const azul = [37, 99, 235];
  const azulClaro = [239, 246, 255];
  const cinza = [100, 116, 139];
  const texto = [30, 41, 59];

  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const margem = 15;
  const larguraUtil = largura - margem * 2;

  const formatarData = data => {
    if (!data) return "Sem data";

    const valor = String(data).slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      return "Sem data";
    }

    const [ano, mes, dia] = valor.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const formatarDataFiltro = data =>
    data ? formatarData(data) : "Não informada";

  const ordenacoes = {
    melhor: "Melhor avaliação",
    pior: "Pior avaliação",
    recente: "Mais recentes",
    antigo: "Mais antigos"
  };

  let y = 20;

  // Cabeçalho
  doc.setFillColor(...azul);
  doc.rect(0, 0, largura, 38, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Ranking dos jogos", margem, 17);

  doc.setFont("helvetica", "normal");
doc.setFontSize(10);
doc.text("SYNGEST - Gestão Esportiva | Avaliação dos jogos", margem, 26);

  doc.setFontSize(9);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    largura - margem,
    33,
    { align: "right" }
  );

  y = 49;

  // Período e ordenação
  doc.setFillColor(...azulClaro);
  doc.roundedRect(margem, y, larguraUtil, 27, 3, 3, "F");

  doc.setTextColor(...cinza);
  doc.setFontSize(9);
  doc.text(
    `Data inicial: ${formatarDataFiltro(filtros.dataInicial)}`,
    margem + 5,
    y + 8
  );

  doc.text(
    `Data final: ${formatarDataFiltro(filtros.dataFinal)}`,
    margem + 5,
    y + 17
  );

  doc.text(
    `Ordenação: ${ordenacoes[filtros.ordenacao] || "Mais recentes"}`,
    margem + 5,
    y + 23
  );

  y += 37;

  // Resumo
  doc.setTextColor(...cinza);
  doc.setFontSize(9);
  doc.text("PARTIDAS AVALIADAS", margem + 5, y + 8);

  doc.setTextColor(...azul);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(String(jogos.length), margem + 5, y + 19);

  doc.setFillColor(...azulClaro);
  doc.roundedRect(margem, y, larguraUtil, 25, 3, 3, "F");

  doc.setTextColor(...cinza);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("PARTIDAS AVALIADAS", margem + 5, y + 8);

  doc.setTextColor(...azul);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(String(jogos.length), margem + 5, y + 19);

  y += 36;

  // Lista de partidas
  jogos.forEach((jogo, index) => {
    const local = String(jogo.local || "Local não informado");
    const linhasLocal = doc.splitTextToSize(local, larguraUtil - 40);
    const media = Math.max(
      0,
      Math.min(5, Number(jogo.media_geral) || 0)
    );
    const percentual = media / 5;

    const alturaCartao = 35 + Math.max(0, linhasLocal.length - 1) * 5;

    if (y + alturaCartao > altura - 18) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(
      margem,
      y,
      larguraUtil,
      alturaCartao,
      3,
      3,
      "F"
    );

    doc.setFillColor(...azul);
    doc.roundedRect(margem, y, 2, alturaCartao, 1, 1, "F");

    doc.setTextColor(...azul);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${index + 1}º lugar`, margem + 7, y + 9);

    doc.setTextColor(...texto);
    doc.text(
      `${media.toFixed(2).replace(".", ",")}/5`,
      largura - margem - 7,
      y + 9,
      { align: "right" }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(linhasLocal, margem + 7, y + 17);

    const yData = y + 17 + linhasLocal.length * 5;

    doc.setTextColor(...cinza);
    doc.setFontSize(9);
    doc.text(`Data: ${formatarData(jogo.data)}`, margem + 7, yData);

    doc.text(
      `${Number(jogo.total_avaliacoes) || 0} avaliação(ões)`,
      largura - margem - 7,
      yData,
      { align: "right" }
    );

    const yBarra = yData + 5;

    doc.setFillColor(226, 232, 240);
    doc.roundedRect(
      margem + 7,
      yBarra,
      larguraUtil - 14,
      2,
      1,
      1,
      "F"
    );

    doc.setFillColor(...azul);
    doc.roundedRect(
      margem + 7,
      yBarra,
      (larguraUtil - 14) * percentual,
      2,
      1,
      1,
      "F"
    );

    y += alturaCartao + 5;
  });

  // Rodapé e numeração
  const totalPaginas = doc.internal.getNumberOfPages();

  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...cinza);

    doc.text(
      `SYNGEST - Gestão Esportiva | Página ${pagina} de ${totalPaginas}`,
      largura / 2,
      altura - 7,
      { align: "center" }
    );
  }

  doc.save("ranking-jogos-gew-sports.pdf");
}

function exportarReceitasPDF() {
  const relatorio = window.receitasRelatorioPDF;

  if (!relatorio || !Array.isArray(relatorio.movimentos)) {
    mostrarToast("Consulte as receitas antes de exportar.", "error");
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    mostrarToast("A biblioteca de PDF não está disponível.", "error");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const azul = [37, 99, 235];
  const azulClaro = [239, 246, 255];
  const cinza = [100, 116, 139];
  const texto = [30, 41, 59];

  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const margem = 15;
  const larguraUtil = largura - margem * 2;

  const dataBR = data => {
    if (!data) return "Não informada";
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const moeda = valor =>
    Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

  let y = 20;

  // Cabeçalho
  doc.setFillColor(...azul);
  doc.rect(0, 0, largura, 38, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Relatório de receitas", margem, 17);

  doc.setFont("helvetica", "normal");
doc.setFontSize(10);
doc.text(
  `SYNGEST - Gestão Esportiva | ${relatorio.nomeTurma}`,
  margem,
  26
);

  doc.setFontSize(9);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    largura - margem,
    33,
    { align: "right" }
  );

  y = 49;

  // Período consultado
  doc.setFillColor(...azulClaro);
  doc.roundedRect(margem, y, larguraUtil, 23, 3, 3, "F");

  doc.setTextColor(...cinza);
  doc.setFontSize(10);
  doc.text(
    `Data inicial: ${dataBR(relatorio.dataInicial)}`,
    margem + 5,
    y + 9
  );
  doc.text(
    `Data final: ${dataBR(relatorio.dataFinal)}`,
    margem + 5,
    y + 17
  );

  y += 33;

  // Total
  doc.setFillColor(...azulClaro);
  doc.roundedRect(margem, y, larguraUtil, 27, 3, 3, "F");

  doc.setTextColor(...cinza);
  doc.setFontSize(9);
  doc.text("TOTAL DE RECEITAS", margem + 5, y + 9);

  doc.setTextColor(...azul);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(moeda(relatorio.total), margem + 5, y + 20);
  doc.setFont("helvetica", "normal");
doc.setFontSize(9);
doc.setTextColor(...cinza);
doc.text(
  `Total de registros: ${relatorio.totalRegistros}`,
  largura - margem - 5,
  y + 17,
  { align: "right" }
);

  y += 38;

  // Título da tabela
  doc.setTextColor(...texto);
  doc.setFontSize(13);
  doc.text("Detalhamento das receitas", margem, y);
  y += 9;

  const colunas = {
    data: margem + 2,
    descricao: margem + 28,
    tipo: margem + 112,
    valor: largura - margem - 2
  };

  function cabecalhoTabela() {
    doc.setFillColor(...azul);
    doc.rect(margem, y, larguraUtil, 9, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);

    doc.text("Data", colunas.data, y + 6);
    doc.text("Descrição", colunas.descricao, y + 6);
    doc.text("Tipo", colunas.tipo, y + 6);
    doc.text("Valor", colunas.valor, y + 6, { align: "right" });

    y += 9;
  }

  cabecalhoTabela();

  if (relatorio.movimentos.length === 0) {
    doc.setTextColor(...cinza);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      "Nenhuma receita encontrada no período selecionado.",
      margem + 2,
      y + 9
    );
  } else {
    relatorio.movimentos.forEach((item, index) => {
      const descricao = doc.splitTextToSize(
        String(item.descricao || "Receita"),
        78
      );

      const alturaLinha = Math.max(10, descricao.length * 4 + 5);

      if (y + alturaLinha > altura - 18) {
        doc.addPage();
        y = 20;
        cabecalhoTabela();
      }

      if (index % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margem, y, larguraUtil, alturaLinha, "F");
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...texto);

      doc.text(dataBR(item.data), colunas.data, y + 6);
      doc.text(descricao, colunas.descricao, y + 6);
      doc.text(String(item.origem || "Receita"), colunas.tipo, y + 6);
      doc.text(moeda(item.valor), colunas.valor, y + 6, {
        align: "right"
      });

      doc.setDrawColor(226, 232, 240);
      doc.line(margem, y + alturaLinha, largura - margem, y + alturaLinha);

      y += alturaLinha;
    });
  }

  // Rodapé e numeração
  const totalPaginas = doc.internal.getNumberOfPages();

  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...cinza);

    doc.text(
      `SYNGEST - Gestão Esportiva | Página ${pagina} de ${totalPaginas}`,
      largura / 2,
      altura - 7,
      { align: "center" }
    );
  }

  doc.save("receitas-por-periodo.pdf");
}


function exportarDespesasPDF() {
  const relatorio = window.despesasRelatorioPDF;

  if (!relatorio || !Array.isArray(relatorio.movimentos)) {
    mostrarToast("Consulte as despesas antes de exportar.", "error");
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    mostrarToast("A biblioteca de PDF não está disponível.", "error");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const azul = [37, 99, 235];
  const azulClaro = [239, 246, 255];
  const cinza = [100, 116, 139];
  const texto = [30, 41, 59];

  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const margem = 15;
  const larguraUtil = largura - margem * 2;

  const dataBR = data => {
    if (!data) return "Não informada";
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const moeda = valor =>
    Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

  let y = 20;

  
  // Cabeçalho
  doc.setFillColor(...azul);
  doc.rect(0, 0, largura, 38, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Relatório de despesas", margem, 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `SYNGEST - Gestão Esportiva | ${relatorio.nomeTurma}`,
    margem,
    26
  );

  doc.setFontSize(9);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    largura - margem,
    33,
    { align: "right" }
  );


  y = 49;

  // Turma e período
  doc.setFillColor(...azulClaro);
  doc.roundedRect(margem, y, larguraUtil, 32, 3, 3, "F");

  doc.setTextColor(...cinza);
  doc.setFontSize(9);
  doc.text(
    `Turma: ${relatorio.nomeTurma}`,
    margem + 5,
    y + 9
  );
  doc.text(
    `Data inicial: ${dataBR(relatorio.dataInicial)}`,
    margem + 5,
    y + 18
  );
  doc.text(
    `Data final: ${dataBR(relatorio.dataFinal)}`,
    margem + 5,
    y + 26
  );

  y += 42;

  // Resumo financeiro
  doc.setFillColor(...azulClaro);
  doc.roundedRect(margem, y, larguraUtil, 27, 3, 3, "F");

  doc.setTextColor(...cinza);
  doc.setFontSize(9);
  doc.text("TOTAL DE DESPESAS", margem + 5, y + 9);

  doc.setTextColor(...azul);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(moeda(relatorio.total), margem + 5, y + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...cinza);
  doc.text(
    `Total de registros: ${relatorio.totalRegistros}`,
    largura - margem - 5,
    y + 17,
    { align: "right" }
  );

  y += 38;

  // Título da tabela
  doc.setTextColor(...texto);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Detalhamento das despesas", margem, y);
  y += 9;

  const colunas = {
    data: margem + 2,
    descricao: margem + 32,
    valor: largura - margem - 2
  };

  function cabecalhoTabela() {
    doc.setFillColor(...azul);
    doc.rect(margem, y, larguraUtil, 9, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);

    doc.text("Data", colunas.data, y + 6);
    doc.text("Descrição", colunas.descricao, y + 6);
    doc.text("Valor", colunas.valor, y + 6, { align: "right" });

    y += 9;
  }

  cabecalhoTabela();

  if (relatorio.movimentos.length === 0) {
    doc.setTextColor(...cinza);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      "Nenhuma despesa encontrada no período selecionado.",
      margem + 2,
      y + 9
    );
  } else {
    relatorio.movimentos.forEach((item, index) => {
      const descricao = doc.splitTextToSize(
        String(item.descricao || "Despesa"),
        100
      );

      const alturaLinha = Math.max(10, descricao.length * 4 + 5);

      if (y + alturaLinha > altura - 18) {
        doc.addPage();
        y = 20;
        cabecalhoTabela();
      }

      if (index % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margem, y, larguraUtil, alturaLinha, "F");
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...texto);

      doc.text(dataBR(item.data), colunas.data, y + 6);
      doc.text(descricao, colunas.descricao, y + 6);
      doc.text(moeda(item.valor), colunas.valor, y + 6, {
        align: "right"
      });

      doc.setDrawColor(226, 232, 240);
      doc.line(
        margem,
        y + alturaLinha,
        largura - margem,
        y + alturaLinha
      );

      y += alturaLinha;
    });
  }

  // Numeração das páginas
  const totalPaginas = doc.internal.getNumberOfPages();

  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...cinza);

    doc.text(
      `SYNGEST - Gestão Esportiva | Página ${pagina} de ${totalPaginas}`,
      largura / 2,
      altura - 7,
      { align: "center" }
    );
  }

  doc.save("despesas-por-periodo-syngest.pdf");
}


function exportarResultadoPeriodoPDF() {
  const relatorio = window.resultadoPeriodoRelatorioPDF;

  if (!relatorio || !Array.isArray(relatorio.movimentos)) {
    mostrarToast("Consulte o resultado financeiro antes de exportar.", "error");
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    mostrarToast("A biblioteca de PDF não está disponível.", "error");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const azul = [37, 99, 235];
  const azulClaro = [239, 246, 255];
  const cinza = [100, 116, 139];
  const texto = [30, 41, 59];
  const verde = [22, 163, 74];
  const vermelho = [220, 38, 38];

  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  const margem = 15;
  const larguraUtil = largura - margem * 2;

  const dataBR = data => {
    if (!data) return "Não informada";
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  };

  const moeda = valor =>
    Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

  let y = 20;

  // Cabeçalho
  doc.setFillColor(...azul);
  doc.rect(0, 0, largura, 38, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Resultado financeiro", margem, 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `SYNGEST - Gestão Esportiva | ${relatorio.nomeTurma}`,
    margem,
    26
  );

  doc.setFontSize(9);
  doc.text(
    `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    largura - margem,
    33,
    { align: "right" }
  );

  y = 49;

  // Período consultado
  doc.setFillColor(...azulClaro);
  doc.roundedRect(margem, y, larguraUtil, 23, 3, 3, "F");

  doc.setTextColor(...cinza);
  doc.setFontSize(10);
  doc.text(
    `Data inicial: ${dataBR(relatorio.dataInicial)}`,
    margem + 5,
    y + 9
  );
  doc.text(
    `Data final: ${dataBR(relatorio.dataFinal)}`,
    margem + 5,
    y + 17
  );

  y += 33;

  // Cartões financeiros
  const espacamento = 4;
  const larguraCartao = (larguraUtil - espacamento * 2) / 3;

  const cartoes = [
    {
      titulo: "TOTAL DE RECEITAS",
      valor: relatorio.totalReceitas,
      cor: verde
    },
    {
      titulo: "TOTAL DE DESPESAS",
      valor: relatorio.totalDespesas,
      cor: vermelho
    },
    {
      titulo: "SALDO DO PERÍODO",
      valor: relatorio.saldo,
      cor: relatorio.saldo >= 0 ? verde : vermelho
    }
  ];

  cartoes.forEach((cartao, index) => {
    const x = margem + index * (larguraCartao + espacamento);

    doc.setFillColor(...azulClaro);
    doc.roundedRect(x, y, larguraCartao, 29, 3, 3, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...cinza);
    doc.text(cartao.titulo, x + 4, y + 8);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...cartao.cor);

    doc.text(
      moeda(cartao.valor),
      x + 4,
      y + 20
    );
  });

  y += 39;

  // Quantidade de registros
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...cinza);
  doc.text(
    `Total de movimentações: ${relatorio.totalRegistros}`,
    margem,
    y
  );

  y += 10;

  // Título da tabela
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...texto);
  doc.text("Detalhamento das movimentações", margem, y);

  y += 9;

  const colunas = {
    data: margem + 2,
    descricao: margem + 28,
    tipo: largura - margem - 48,
    valor: largura - margem - 2
  };

  function cabecalhoTabela() {
    doc.setFillColor(...azul);
    doc.rect(margem, y, larguraUtil, 9, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    doc.text("Data", colunas.data, y + 6);
    doc.text("Descrição", colunas.descricao, y + 6);
    doc.text("Tipo", colunas.tipo, y + 6);
    doc.text("Valor", colunas.valor, y + 6, { align: "right" });

    y += 9;
  }

  cabecalhoTabela();

  if (relatorio.movimentos.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...cinza);
    doc.text(
      "Nenhuma movimentação encontrada no período selecionado.",
      margem + 2,
      y + 9
    );
  } else {
    relatorio.movimentos.forEach((item, index) => {
      const descricao = doc.splitTextToSize(
        String(item.descricao || "Movimentação"),
        78
      );

      const alturaLinha = Math.max(10, descricao.length * 4 + 5);

      if (y + alturaLinha > altura - 18) {
        doc.addPage();
        y = 20;
        cabecalhoTabela();
      }

      if (index % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margem, y, larguraUtil, alturaLinha, "F");
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...texto);

      doc.text(dataBR(item.data), colunas.data, y + 6);
      doc.text(descricao, colunas.descricao, y + 6);

      doc.setTextColor(
        ...(item.tipo === "Receita" ? verde : vermelho)
      );
      doc.text(String(item.tipo || "Movimentação"), colunas.tipo, y + 6);

      doc.setTextColor(...texto);
      doc.text(moeda(item.valor), colunas.valor, y + 6, {
        align: "right"
      });

      doc.setDrawColor(226, 232, 240);
      doc.line(
        margem,
        y + alturaLinha,
        largura - margem,
        y + alturaLinha
      );

      y += alturaLinha;
    });
  }

  // Numeração das páginas
  const totalPaginas = doc.internal.getNumberOfPages();

  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...cinza);

    doc.text(
      `SYNGEST - Gestão Esportiva | Página ${pagina} de ${totalPaginas}`,
      largura / 2,
      altura - 7,
      { align: "center" }
    );
  }

  doc.save("resultado-financeiro-syngest.pdf");
}

async function gerarRelatorioParticipacoes() {
  const resultado = document.getElementById("resultadoRelatorioParticipacoes");
  const dataInicial = document.getElementById("dataInicialParticipacoes").value;
  const dataFinal = document.getElementById("dataFinalParticipacoes").value;

  if (!dataInicial || !dataFinal) {
    mostrarToast("Informe a data inicial e a data final.");
    return;
  }

  if (dataInicial > dataFinal) {
    mostrarToast("A data inicial não pode ser posterior à data final.");
    return;
  }

  const turmaSelecionada = JSON.parse(
    localStorage.getItem("turmaSelecionada") || "null"
  );

  const turmaId = Number(turmaSelecionada?.turma_id);

  if (!turmaId) {
    mostrarToast("Nenhuma turma selecionada.");
    return;
  }

  try {
    const dados = await apiGet(
      `/relatorios/${turmaId}/participacoes?dataInicial=${dataInicial}&dataFinal=${dataFinal}`
    );

    const mensalistas = Number(dados.totalMensalistas) || 0;
    const convidados = Number(dados.totalConvidados) || 0;
    const total = mensalistas + convidados;
    const percentualMensalistas = total > 0
    ? (mensalistas / total * 100).toFixed(1)
    : "0.0";
    const percentualConvidados = total > 0
    ? (convidados / total * 100).toFixed(1)
    : "0.0";

    resultado.style.display = "block";
    resultado.innerHTML = "";

    
const resumo = document.createElement("div");
resumo.style.cssText = `
  margin-top: 16px;
  padding: 20px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.04);
`;

const titulo = document.createElement("h3");
titulo.textContent = "Participações no período";
titulo.style.cssText = `
  margin: 0 0 6px;
  color: #1e293b;
  font-size: 16px;
  font-weight: 700;
`;

const periodo = document.createElement("p");
periodo.textContent =
  `${dataInicial.split("-").reverse().join("/")} a ` +
  `${dataFinal.split("-").reverse().join("/")}`;
periodo.style.cssText = `
  margin: 0 0 18px;
  color: #64748b;
  font-size: 13px;
`;

const indicadores = document.createElement("div");
indicadores.style.cssText = `
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
`;

function criarIndicador(titulo, quantidade, percentual, cor) {
  const card = document.createElement("div");
  card.style.cssText = `
    min-width: 0;
    padding: 16px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #f8fafc;
    border-top: 3px solid ${cor};
  `;

  const nome = document.createElement("div");
  nome.textContent = titulo;
  nome.style.cssText = `
    color: #64748b;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 8px;
  `;

  const linha = document.createElement("div");
  linha.style.cssText = `
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px;
  `;

  const numero = document.createElement("strong");
  numero.textContent = quantidade;
  numero.style.cssText = `
    color: #1e293b;
    font-size: 26px;
    line-height: 1.2;
  `;

  const percentualTexto = document.createElement("span");
  percentualTexto.textContent = `${percentual}%`;
  percentualTexto.style.cssText = `
    color: ${cor};
    font-size: 13px;
    font-weight: 700;
  `;

  linha.append(numero, percentualTexto);
  card.append(nome, linha);

  return card;
}

indicadores.append(
  criarIndicador("Mensalistas", mensalistas, percentualMensalistas, "#3478f6"),
  criarIndicador("Convidados", convidados, percentualConvidados, "#8b5cf6")
);

const faixaTotal = document.createElement("div");
faixaTotal.style.cssText = `
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
  padding: 14px 16px;
  background: #eff6ff;
  border-radius: 10px;
`;

const textoTotal = document.createElement("span");
textoTotal.textContent = "Total de participações";
textoTotal.style.cssText = `
  color: #334155;
  font-size: 14px;
  font-weight: 600;
`;

const numeroTotal = document.createElement("strong");
numeroTotal.textContent = total;
numeroTotal.style.cssText = `
  color: #2563eb;
  font-size: 22px;
`;

faixaTotal.append(textoTotal, numeroTotal);
resumo.append(titulo, periodo, indicadores, faixaTotal);
resultado.appendChild(resumo);

  } catch (erro) {
    console.error("Erro ao gerar relatório de participações:", erro);
  }
}