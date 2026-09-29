# Robo Study Selection - Parsifal Automation

Este projeto é um script de automação web desenvolvido em **Node.js** utilizando a biblioteca **Puppeteer**. Seu objetivo é automatizar a fase de "Study Selection" (Seleção de Estudos) em Revisões Sistemáticas da Literatura (SLR) na plataforma [Parsifal](https://parsif.al/).

O robô lê uma lista de artigos previamente avaliados a partir de um arquivo de texto, acessa a conta do pesquisador no Parsifal, percorre a lista de estudos importados e classifica automaticamente os artigos como **Accepted** ou **Rejected**.

## Funcionalidades

- **Login Automatizado:** Acessa o Parsifal de forma autônoma utilizando credenciais seguras via variáveis de ambiente.
- **Leitura Resiliente:** Processa a lista de artigos aceitos ignorando pontuações, acentos e caracteres especiais para evitar falsos negativos na comparação de títulos.
- **Classificação Inteligente:**
  - Aceita (`Accepted`) artigos presentes na lista de aprovação.
  - Rejeita (`Rejected`) artigos que não constam na lista.
  - Pula artigos que já foram classificados anteriormente (economizando tempo e evitando retrabalho).
- **Controle de Paginação:** Identifica a quantidade exata de artigos na base de dados e percorre o modal do Parsifal clicando em "Save" e "Next" de forma segura.

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

3. Na raiz da pasta `robo_StudySelection`, crie um arquivo chamado **`.env`** e insira as suas credenciais e a URL do seu projeto. **Atenção:** Não utilize aspas.

   ```env
   EMAIL=seu_email@exemplo.com
   SENHA=sua_senha_do_parsifal
   URL_PROJETO=https://parsif.al/seu_usuario/seu-projeto/conducting/studies/
   ```

4. Na mesma pasta, mantenha o arquivo **`artigos.csv`** exportado com as colunas
   `Título Original` e `Sugestão de Decisão`.
   - Artigos cuja `Sugestão de Decisão` seja **`Accepted`** serão aceitos.
   - Os demais artigos serão classificados como **`Rejected`**.

## Como Executar

Com todas as configurações feitas, execute o comando abaixo no terminal (certifique-se de estar dentro da pasta `robo_StudySelection`):

```bash
node index.js
```

O robô abrirá uma janela do navegador, realizará o login e começará a triagem. Você poderá acompanhar o progresso diretamente pelos logs no seu terminal (ex: `[15/63] Aceitando: Nome do Artigo`).

**Aviso:** Não clique ou interaja com a janela do navegador aberto pelo robô enquanto a automação estiver em andamento, pois isso pode interromper o fluxo de cliques automáticos.

## Segurança

As senhas e informações sensíveis são gerenciadas pelo arquivo `.env`, que está listado no `.gitignore` e **nunca** deve ser enviado para repositórios públicos no GitHub.
