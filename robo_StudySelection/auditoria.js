require("dotenv").config();
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const csv = require("csv-parser");

// Padroniza os textos para comparação exata
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

// Lê títulos com decisão Accepted do CSV local
async function carregarArtigosCSV(caminhoCsv) {
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

async function rodarAuditoria() {
  console.log("Lendo arquivo CSV local...");
  const csvTitulos = await carregarArtigosCSV(
    path.join(__dirname, "artigos.csv"),
  );
  console.log(`Total de 'Accepted' no CSV: ${csvTitulos.size}`);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    executablePath:
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  });
  const page = await browser.newPage();

  console.log("Fazendo login no Parsifal...");
  await page.goto("https://parsif.al/login/");
  await page.type("#id_username", process.env.EMAIL);
  await page.type("#id_password", process.env.SENHA);
  await Promise.all([
    page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);

  console.log("Acessando seleção de estudos...");
  await page.goto(process.env.URL_PROJETO);

  try {
    await page.waitForSelector("table tbody tr", { timeout: 10000 });
  } catch (error) {
    console.log("Erro: Não encontrou artigos na página.");
    await browser.close();
    return;
  }

  console.log("Aplicando filtro 'Accepted'...");
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll("label"));
    const labelAccepted = labels.find((l) => l.innerText.trim() === "Accepted");
    if (labelAccepted) labelAccepted.click();
  });

  // Aguarda tabela recarregar com os aceitos
  await new Promise((r) => setTimeout(r, 4000));

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
    console.log("Nenhum artigo 'Accepted' encontrado no Parsifal.");
    await browser.close();
    return;
  }

  console.log(`Coletando ${totalArtigos} artigos no Parsifal. Aguarde...`);

  await page.evaluate(() => {
    const primeiraLinha = document.querySelector("table tbody tr:first-child");
    if (primeiraLinha) primeiraLinha.click();
  });
  await page.waitForSelector(".modal-dialog");

  const parsifalTitulos = new Set();
  const titulosOriginais = {}; // Guarda o título original para exibir no log final

  let artigosLidos = 0;

  while (true) {
    artigosLidos++;

    let elementoTitulo = await page
      .waitForSelector('input[name="title"]', { timeout: 10000 })
      .catch(() => null);

    if (!elementoTitulo) {
      console.log("Tentando recarregar o artigo...");
      elementoTitulo = await page
        .waitForSelector('input[name="title"]', { timeout: 15000 })
        .catch(() => null);
    }

    if (!elementoTitulo) {
      console.log(`Erro ao ler artigo. Pulando...`);
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
    const tituloPadronizado = padronizarTexto(tituloBruto);

    // Trava de loop do Parsifal
    if (parsifalTitulos.has(tituloPadronizado)) {
      break;
    }

    parsifalTitulos.add(tituloPadronizado);
    titulosOriginais[tituloPadronizado] = tituloBruto;

    // Clica em Next sem salvar nada
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

    await new Promise((r) => setTimeout(r, 1000));
  }

  await browser.close();

  console.log("\n=== RESULTADO DA AUDITORIA ===");

  // Cruzamento de dados
  const faltandoNoParsifal = [...csvTitulos].filter(
    (t) => !parsifalTitulos.has(t),
  );
  const extrasNoParsifal = [...parsifalTitulos].filter(
    (t) => !csvTitulos.has(t),
  );

  if (faltandoNoParsifal.length === 0 && extrasNoParsifal.length === 0) {
    console.log(
      "Sucesso Absoluto! Todos os artigos do CSV estão iguais no Parsifal.",
    );
  } else {
    if (faltandoNoParsifal.length > 0) {
      console.log(
        `\n FALTANDO NO PARSIFAL (${faltandoNoParsifal.length} artigos):`,
      );
      console.log(
        "Estes artigos estão como 'Accepted' no CSV, mas NÃO no Parsifal.",
      );
      faltandoNoParsifal.forEach((t) => console.log(` - ${t}`));
    }

    if (extrasNoParsifal.length > 0) {
      console.log(
        `\n EXTRA NO PARSIFAL (${extrasNoParsifal.length} artigos):`,
      );
      console.log(
        "Estes artigos estão 'Accepted' no Parsifal, mas NÃO constam no CSV.",
      );
      extrasNoParsifal.forEach((t) => console.log(` - ${titulosOriginais[t]}`));
    }
  }
}

rodarAuditoria();
