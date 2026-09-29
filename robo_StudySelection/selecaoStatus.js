require("dotenv").config();
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const csv = require("csv-parser");

// Padroniza removendo acentos e pontuações
const padronizarTexto = (texto) => {
  if (!texto) return "";
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
};

// Lê títulos com decisão Accepted
async function carregarArtigos(caminhoCsv) {
  const titulos = new Set();

  let conteudo = fs.readFileSync(caminhoCsv, "utf8");
  conteudo = conteudo.replace(/^([,\s]*\r?\n)+/, "");

  return new Promise((resolve, reject) => {
    Readable.from(conteudo)
      .pipe(
        csv({
          mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, ""),
        }),
      )
      .on("data", (artigo) => {
        const tituloBruto = artigo["Título Original"];
        const decisaoBruto = artigo["Sugestão de Decisão"];

        if (tituloBruto && decisaoBruto) {
          const titulo = padronizarTexto(tituloBruto);
          const decisao = padronizarTexto(decisaoBruto);

          if (decisao === "accepted") {
            titulos.add(titulo);
          }
        }
      })
      .on("end", () => resolve(titulos))
      .on("error", reject);
  });
}

async function rodarRobo() {
  console.log("Lendo arquivo de artigos...");
  const titulosAceitos = await carregarArtigos(
    path.join(__dirname, "artigos.csv"),
  );

  console.log(`Artigos 'Accepted' em memória: ${titulosAceitos.size}`);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    executablePath:
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  });
  const page = await browser.newPage();

  console.log("Fazendo login...");
  await page.goto("https://parsif.al/login/");

  await page.type("#id_username", process.env.EMAIL);
  await page.type("#id_password", process.env.SENHA);

  await Promise.all([
    page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);

  console.log("Acessando seleção de estudos...");
  await page.goto(process.env.URL_PROJETO);

  console.log("Aguardando a lista de artigos carregar...");
  try {
    await page.waitForSelector("table tbody tr", { timeout: 10000 });
  } catch (error) {
    console.log("Erro: Não encontrou artigos na página.");
    await browser.close();
    return;
  }

  console.log("Aplicando filtro 'Unclassified'...");

  // Clica no texto (Label) do filtro para forçar a ação no Parsifal
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll("label"));
    const labelUnclassified = labels.find(
      (l) => l.innerText.trim() === "Unclassified",
    );
    if (labelUnclassified) {
      labelUnclassified.click();
    }
  });

  // Aguarda a tabela recarregar com o filtro aplicado
  await new Promise((r) => setTimeout(r, 4000));

  // Conta apenas os artigos que estão visíveis na tela (ignora os ocultos por CSS)
  const totalArtigos = await page.$$eval(
    "table tbody tr",
    (linhas) =>
      linhas.filter(
        (l) => l.style.display !== "none" && !l.classList.contains("hidden"),
      ).length,
  );

  if (
    totalArtigos === 0 ||
    (totalArtigos === 1 &&
      (await page.$eval("table tbody tr", (el) =>
        el.innerText.includes("No data"),
      )))
  ) {
    console.log("Nenhum artigo pendente encontrado. Automação finalizada!");
    await browser.close();
    return;
  }

  console.log(`Restam ${totalArtigos} artigos pendentes. Retomando triagem...`);

  await page.evaluate(() => {
    const primeiraLinha = document.querySelector("table tbody tr:first-child");
    if (primeiraLinha) primeiraLinha.click();
  });

  await page.waitForSelector(".modal-dialog");

  let artigosProcessados = 0;
  const artigosVisitados = new Set();

  while (true) {
    artigosProcessados++;

    let elementoTitulo = await page
      .waitForSelector('input[name="title"]', { timeout: 15000 })
      .catch(() => null);

    if (!elementoTitulo) {
      console.log(`Lentidão no Parsifal detectada. Aguardando mais 15s...`);
      elementoTitulo = await page
        .waitForSelector('input[name="title"]', { timeout: 15000 })
        .catch(() => null);
    }

    if (!elementoTitulo) {
      console.log(
        `Erro crítico de carregamento. Pulando artigo para evitar travamento.`,
      );
      await page.evaluate(() => {
        const botoes = Array.from(document.querySelectorAll("button"));
        const btnNext = botoes.find(
          (b) => b.innerText.trim() === "Next" && !b.disabled,
        );
        if (btnNext) btnNext.click();
      });
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    const tituloBruto = await page.evaluate((el) => el.value, elementoTitulo);
    const tituloAtual = padronizarTexto(tituloBruto);

    // TRAVA ANTI-LOOP: Verifica se o robô voltou ao início da lista
    if (artigosVisitados.has(tituloAtual)) {
      console.log(
        "\n[!] Loop detectado: O Parsifal voltou ao início da lista.",
      );
      console.log("Todos os artigos pendentes foram classificados!");
      break;
    }
    artigosVisitados.add(tituloAtual);

    let statusDesejado = titulosAceitos.has(tituloAtual)
      ? "Accepted"
      : "Rejected";

    console.log(
      `[${artigosProcessados}/${totalArtigos}] ${statusDesejado === "Accepted" ? "Aceitando" : "Recusando"}: ${tituloBruto}`,
    );

    await page.evaluate((statusNome) => {
      const statusSelect = document.querySelector('select[name="status"]');
      if (statusSelect) {
        for (let i = 0; i < statusSelect.options.length; i++) {
          if (statusSelect.options[i].text.includes(statusNome)) {
            statusSelect.value = statusSelect.options[i].value;
            statusSelect.dispatchEvent(new Event("change", { bubbles: true }));
            break;
          }
        }
      }
    }, statusDesejado);

    await new Promise((r) => setTimeout(r, 800));

    await page.evaluate(() => {
      const botoes = Array.from(document.querySelectorAll("button"));
      const btnSave = botoes.find((b) => b.innerText.trim() === "Save");
      if (btnSave) btnSave.click();
    });

    await new Promise((r) => setTimeout(r, 2000));

    let clicouNext = false;
    for (let i = 0; i < 3; i++) {
      clicouNext = await page.evaluate(() => {
        const botoes = Array.from(document.querySelectorAll("button"));
        const btnNext = botoes.find(
          (b) => b.innerText.trim() === "Next" && !b.disabled,
        );
        if (btnNext) {
          btnNext.click();
          return true;
        }
        return false;
      });

      if (clicouNext) break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log("Automação finalizada com sucesso!");
  await browser.close();
}

rodarRobo();
