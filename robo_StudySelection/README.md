# Robo Study Selection - Parsifal Automation

Este projeto é um conjunto de scripts de automação web desenvolvidos em **Node.js** utilizando a biblioteca **Puppeteer**. Seu objetivo é automatizar a fase de "Study Selection" (Seleção de Estudos) em Revisões Sistemáticas da Literatura (SLR) na plataforma [Parsifal](https://parsif.al/).

O projeto oferece diferentes abordagens para realizar a classificação (individual ou em lote) baseando-se em um arquivo de texto local (`artigos.csv`), além de um sistema de auditoria para garantir a integridade dos dados finais.

## Preparação de Dados (Muito Importante)

Para garantir a agilidade e a precisão de qualquer um dos scripts de automação, é estritamente necessário realizar um pré-processamento na sua base de dados antes de exportar o arquivo CSV. **Certifique-se de ter eliminado previamente:**
- Artigos duplicados.
- Revisões (reviews) que não se aplicam aos critérios.
- Entradas sem título ou com dados corrompidos.
Realizar essa limpeza otimiza drasticamente o tempo de execução e evita que o robô trave ou gere falsos positivos.

## Funcionalidades e Scripts

O repositório é composto por três scripts principais, adequados para diferentes necessidades do processo de triagem:

1. **`selecaoStatus.js` (Classificação Individual):** Percorre a lista de estudos importados e abre o modal de cada um, classificando-os como **Accepted** ou **Rejected** um a um. Esse processo é minucioso, porém **demora bastante** devido ao tempo de carregamento individual de cada artigo e salvamento no servidor do Parsifal.
2. **`selecaoCheckbox.js` (Seleção em Lote):** Uma abordagem focada em velocidade. O robô lê e compara os títulos, marcando apenas as caixas de seleção (checkbox) dos artigos na página principal. **Importante:** Para este script, o arquivo `artigos.csv` deve conter **apenas** a lista de artigos aceitos. Ao final, o navegador permanece aberto para que o pesquisador selecione manualmente a ação "Mark as accepted" no menu do site.
3. **`auditoria.js` (Conferência):** Script de verificação que cruza os dados dos artigos com status "Accepted" na plataforma Parsifal contra a sua lista original do CSV, apontando inconsistências (artigos que faltaram ser marcados ou que foram marcados indevidamente).

## Tecnologias Utilizadas

- [Node.js](https://nodejs.org/)
- [Puppeteer](https://pptr.dev/) (Automação de navegador simulando o Microsoft Edge)
- [Dotenv](https://www.npmjs.com/package/dotenv) (Gerenciamento de variáveis de ambiente)

## Pré-requisitos

1. **Node.js** instalado na sua máquina.
2. Navegador **Microsoft Edge** instalado (o caminho padrão utilizado no script é `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`).
3. Uma conta ativa no Parsifal com um projeto de revisão criado e artigos importados.

## Instalação e Configuração

1. Clone o repositório ou acesse a pasta do projeto no seu terminal:

   ```bash
   cd robo_StudySelection
   ```

2. Instale as dependências necessárias:

   ```bash
   npm install
   ```

3. Na raiz da pasta `robo_StudySelection`, crie um arquivo chamado **`.env`** (você pode usar o `.env.example` como base) e insira as suas credenciais e a URL do seu projeto. **Atenção:** Não utilize aspas.

   ```env
   EMAIL=seu_email@exemplo.com
   SENHA=sua_senha_do_parsifal
   URL_PROJETO=https://parsif.al/seu_usuario/seu-projeto/conducting/studies/
   ```

4. Prepare o seu arquivo **`artigos.csv`** na mesma pasta.
   - Para o script `selecaoStatus.js`: Pode conter todos os artigos com as colunas `Título Original` e `Sugestão de Decisão`.
   - Para o script `selecaoCheckbox.js`: Deve conter **exclusivamente** os artigos que serão aceitos.

