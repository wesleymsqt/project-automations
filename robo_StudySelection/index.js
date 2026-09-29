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

// Lê títulos com decisão Accepted tratando linhas iniciais vazias
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

  // Encontra e clica no botão de rádio "Unclassified"
  await page.evaluate(() => {
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
    const unclassifiedRadio = radios.find((r) =>
      r.parentNode.textContent.includes("Unclassified"),
    );
    if (unclassifiedRadio) {
      unclassifiedRadio.click();
    }
  });

  // Aguarda 3 segundos para o site recarregar a tabela apenas com os pendentes
  await new Promise((r) => setTimeout(r, 3000));

  // Conta os artigos que restaram na tabela filtrada
  const totalArtigos = await page.$$eval(
    "table tbody tr",
    (linhas) => linhas.length,
  );

  // Trava de segurança: Se a tabela esvaziou, encerra.
  if (
    totalArtigos === 0 ||
    (totalArtigos === 1 &&
      (await page.$eval("table tbody tr", (el) =>
        el.innerText.includes("No data"),
      )))
  ) {
    console.log(
      "Nenhum artigo pendente (Unclassified) encontrado. Todos já foram classificados!",
    );
    await browser.close();
    return;
  }

  console.log(`Restam ${totalArtigos} artigos pendentes. Retomando triagem...`);

  await page.click("table tbody tr:first-child");
  await page.waitForSelector(".modal-dialog");

  let artigosProcessados = 0;

  while (artigosProcessados < totalArtigos) {
    artigosProcessados++;

    let elementoTitulo = await page
      .waitForSelector('input[name="title"]', { timeout: 15000 })
      .catch(() => null);

    if (!elementoTitulo) {
      console.log(
        `[${artigosProcessados}/${totalArtigos}] Lentidão no Parsifal detectada. Aguardando mais 15s...`,
      );
      elementoTitulo = await page
        .waitForSelector('input[name="title"]', { timeout: 15000 })
        .catch(() => null);
    }

    if (!elementoTitulo) {
      console.log(
        `[${artigosProcessados}/${totalArtigos}] Erro crítico de carregamento. Pulando artigo para evitar travamento.`,
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

    if (artigosProcessados >= totalArtigos) {
      break;
    }

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
