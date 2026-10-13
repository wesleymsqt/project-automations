require("dotenv").config();
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const csv = require("csv-parser");

// Remove acentos, caracteres especiais e espaços
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

// Lê CSV e extrai Título Original
async function carregarArtigos(caminhoCsv) {
  const titulos = new Set();
  let conteudo = fs.readFileSync(caminhoCsv, "utf8");

  const linhas = conteudo.split(/\r?\n/);
  if (linhas.length > 0 && linhas[0].includes("ARTIGOS ACEITOS")) {
    linhas.shift();
  }
  conteudo = linhas.join("\n");

  return new Promise((resolve, reject) => {
    Readable.from(conteudo)
      .pipe(
        csv({
          mapHeaders: ({ header }) => header.trim().replace(/^\uFEFF/, ""),
        }),
      )
      .on("data", (artigo) => {
        const tituloBruto = artigo["Título Original"];
        if (tituloBruto) {
          titulos.add(padronizarTexto(tituloBruto));
        }
      })
      .on("end", () => resolve(Array.from(titulos)))
      .on("error", reject);
  });
}

// Automação principal
async function verificarArtigos() {
  console.log("Lendo arquivo de artigos...");
  const titulosCsv = await carregarArtigos(path.join(__dirname, "artigos.csv"));
  console.log(`Artigos carregados do CSV: ${titulosCsv.length}`);

  // Inicia navegador
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    executablePath:
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  });
  const page = await browser.newPage();

  console.log("Fazendo login...");
  await page.goto("https://parsif.al/login/");

  // Preenche credenciais
  await page.type("#id_username", process.env.EMAIL);
  await page.type("#id_password", process.env.SENHA);

  await Promise.all([
    page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);

  console.log("Acessando seleção de estudos...");
  await page.goto(process.env.URL_PROJETO);

  // Aguarda carregamento inicial
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

  await new Promise((r) => setTimeout(r, 4000));

  console.log("Rolando a página para carregar todos os artigos...");
  // Scroll automático
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 800;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 300);
    });
  });

  await new Promise((r) => setTimeout(r, 2000));

  console.log("Extraindo títulos do Parsifal...");

  // Captura todos os títulos aceitos listados na tabela
  const titulosParsifal = await page.evaluate(() => {
    const padronizar = (t) => {
      if (!t) return "";
      return t
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    };

    const linhas = document.querySelectorAll("table tbody tr");
    const encontrados = [];

    linhas.forEach((linha) => {
      if (linha.style.display === "none" || linha.classList.contains("hidden"))
        return;

      const colunas = linha.querySelectorAll("td");
      if (colunas.length < 3) return;

      // 3ª coluna tem o título original
      const titulo = colunas[2].innerText;
      if (titulo) encontrados.push(padronizar(titulo));
    });

    return encontrados;
  });

  // Fecha navegador após extração
  await browser.close();

  // Compara as listas
  console.log("Comparando dados...\n");

  const faltantesNoParsifal = titulosCsv.filter(
    (tituloCsv) => !titulosParsifal.includes(tituloCsv),
  );

  // Relatório Final
  console.log("=== RELATÓRIO DE VERIFICAÇÃO ===");
  console.log(`Total de artigos no CSV: ${titulosCsv.length}`);
  console.log(
    `Total de artigos 'Accepted' no Parsifal: ${titulosParsifal.length}`,
  );
  console.log(
    `\nArtigos no CSV que NÃO estão marcados como Accepted no Parsifal (${faltantesNoParsifal.length}):`,
  );

  if (faltantesNoParsifal.length > 0) {
    faltantesNoParsifal.forEach((t, i) => console.log(`${i + 1}. ${t}`));
  } else {
    console.log("Todos os artigos do CSV constam como Accepted no Parsifal!");
  }
}

verificarArtigos();
