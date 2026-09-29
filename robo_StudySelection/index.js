require("dotenv").config();
const puppeteer = require("puppeteer");
const fs = require("fs");

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

// Lê o arquivo ignorando o cabeçalho
async function carregarArtigos(caminhoCsv) {
  const titulos = new Set();
  const conteudo = fs.readFileSync(caminhoCsv, "utf8");
  const linhas = conteudo.split(/\r?\n/);

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (linha) {
      titulos.add(padronizarTexto(linha));
    }
  }
  return titulos;
}

async function rodarRobo() {
  console.log("Lendo arquivo de artigos...");
  const titulosAceitos = await carregarArtigos("artigos_aceitos.csv");

  // Inicia navegador Edge
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    executablePath:
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  });
  const page = await browser.newPage();

  console.log("Fazendo login...");
  await page.goto("https://parsif.al/login/");

  // Usa as variáveis do arquivo .env
  await page.type("#id_username", process.env.EMAIL);
  await page.type("#id_password", process.env.SENHA);

  // Clica e espera navegação
  await Promise.all([
    page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);

  console.log("Acessando seleção de estudos...");
  // Usa a URL do arquivo .env
  await page.goto(process.env.URL_PROJETO);

  console.log("Aguardando a lista de artigos carregar...");
  try {
    await page.waitForSelector("table tbody tr", { timeout: 10000 });
  } catch (error) {
    console.log("Erro: Não encontrou artigos na página.");
    await browser.close();
    return;
  }

  // Conta total de artigos
  const totalArtigos = await page.$$eval(
    "table tbody tr",
    (linhas) => linhas.length,
  );
  console.log(
    `Foram encontrados ${totalArtigos} artigos. Iniciando triagem...`,
  );

  // Abre o modal
  await page.click("table tbody tr:first-child");
  await page.waitForSelector(".modal-dialog");

  let artigosProcessados = 0;

  // Loop de processamento
  while (artigosProcessados < totalArtigos) {
    artigosProcessados++;

    await page
      .waitForSelector('input[name="title"]', { timeout: 5000 })
      .catch(() => {});

    const tituloBruto = await page.$eval(
      'input[name="title"]',
      (el) => el.value,
    );
    const tituloAtual = padronizarTexto(tituloBruto);

    // Verifica status atual
    const statusAtual = await page.evaluate(() => {
      const select = document.querySelector('select[name="status"]');
      return select ? select.options[select.selectedIndex].text.trim() : "";
    });

    if (statusAtual !== "Unclassified") {
      console.log(
        `[${artigosProcessados}/${totalArtigos}] Pulando (já é ${statusAtual}): ${tituloBruto}`,
      );
    } else {
      let statusDesejado = titulosAceitos.has(tituloAtual)
        ? "Accepted"
        : "Rejected";
      console.log(
        `[${artigosProcessados}/${totalArtigos}] ${statusDesejado === "Accepted" ? "Aceitando" : "Recusando"}: ${tituloBruto}`,
      );

      // Altera dropdown
      await page.evaluate((statusNome) => {
        const statusSelect = document.querySelector('select[name="status"]');
        if (statusSelect) {
          for (let i = 0; i < statusSelect.options.length; i++) {
            if (statusSelect.options[i].text.includes(statusNome)) {
              statusSelect.value = statusSelect.options[i].value;
              statusSelect.dispatchEvent(
                new Event("change", { bubbles: true }),
              );
              break;
            }
          }
        }
      }, statusDesejado);

      await new Promise((r) => setTimeout(r, 800));

      // Clica em Save
      await page.evaluate(() => {
        const botoes = Array.from(document.querySelectorAll("button"));
        const btnSave = botoes.find((b) => b.innerText.trim() === "Save");
        if (btnSave) btnSave.click();
      });

      await new Promise((r) => setTimeout(r, 2000));
    }

    if (artigosProcessados >= totalArtigos) {
      break;
    }

    // Tenta clicar no botão Next até 3 vezes
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
