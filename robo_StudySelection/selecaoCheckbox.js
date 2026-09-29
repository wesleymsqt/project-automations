require("dotenv").config();
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const csv = require("csv-parser");

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
        const tituloBruto =
          artigo["Título Original"] || Object.values(artigo)[0];

        if (tituloBruto) {
          titulos.add(padronizarTexto(tituloBruto));
        }
      })
      .on("end", () => resolve(titulos))
      .on("error", reject);
  });
}

async function rodarSelecaoEmLote() {
  console.log("Lendo arquivo de artigos aceitos...");
  const titulosAceitos = await carregarArtigos(
    path.join(__dirname, "artigos.csv"),
  );
  console.log(`Artigos carregados na memória: ${titulosAceitos.size}`);

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

  try {
    await page.waitForSelector("table tbody tr", { timeout: 10000 });
  } catch (error) {
    console.log("Erro: Não encontrou artigos na página.");
    await browser.close();
    return;
  }

  console.log(
    "Aplicando filtro 'Unclassified' para ver apenas os pendentes...",
  );
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll("label"));
    const labelUnclassified = labels.find(
      (l) => l.innerText.trim() === "Unclassified",
    );
    if (labelUnclassified) labelUnclassified.click();
  });

  await new Promise((r) => setTimeout(r, 4000));

  console.log("Rolando a página para carregar todos os artigos na tabela...");

  // Script de auto-scroll para lidar com carregamento lento do Parsifal
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 800; // Pixels por rolagem
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

  console.log("Marcando as caixas de seleção correspondentes...");

  const titulosArray = Array.from(titulosAceitos);

  const marcados = await page.evaluate((titulosParaMarcar) => {
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
    let count = 0;

    linhas.forEach((linha) => {
      if (linha.style.display === "none" || linha.classList.contains("hidden"))
        return;

      const colunas = linha.querySelectorAll("td");
      if (colunas.length < 3) return;

      // A 3ª coluna da tabela armazena os títulos
      const tituloOriginal = colunas[2].innerText;
      const tituloPadronizado = padronizar(tituloOriginal);

      if (titulosParaMarcar.includes(tituloPadronizado)) {
        // A 1ª coluna armazena o checkbox
        const checkbox = colunas[0].querySelector('input[type="checkbox"]');
        if (checkbox && !checkbox.checked) {
          checkbox.click();
          count++;
        }
      }
    });

    return count;
  }, titulosArray);

  console.log(`\n=== SUCESSO ===`);
  console.log(`O robô encontrou e marcou ${marcados} artigos na tela.`);
  console.log(
    "Ação requerida: Vá no menu 'Action', escolha 'Mark as accepted' e clique em 'Go'.",
  );
  console.log(
    "O navegador permanecerá aberto. Pode encerrar o terminal (Ctrl+C) quando finalizar.",
  );

}

rodarSelecaoEmLote();
