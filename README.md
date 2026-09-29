# Automações de Projetos

Bem-vindo ao repositório **Project Automations**! Este repositório central abriga uma coleção de scripts de automação web e bots projetados para otimizar tarefas repetitivas, aumentar a produtividade e automatizar o processamento de dados utilizando Node.js e diversas bibliotecas de automação.

<!-- ## Estrutura do Repositório

Para manter a organização e evitar conflitos entre dependências, cada ferramenta de automação está contida em sua própria pasta isolada. Cada projeto possui seu próprio `package.json`, `node_modules` e instruções de configuração específicas.

```text
project-automations/
│
├── robo_StudySelection/    # Automação para seleção de estudos em SLR no Parsifal
├── (projetos futuros...)   # Outros bots serão adicionados aqui
├── .gitignore              # Regras globais do git ignore (protege todos os arquivos .env)
└── README.md               # Este arquivo
```

## Projetos Atuais

Aqui está uma lista dos scripts de automação disponíveis neste repositório: -->

### [Robo Study Selection](./robo_StudySelection)
Um script em Node.js e Puppeteer criado para automatizar a fase de "Seleção de Estudos" de Revisões Sistemáticas da Literatura (SLR) na plataforma [Parsifal](https://parsif.al/). Ele lê um arquivo `.csv` local e classifica automaticamente os artigos como *Aceitos* ou *Rejeitados* na interface web.
* **Leia a documentação completa e o guia de configuração aqui:** [robo_StudySelection/README.md](./robo_StudySelection/README.md)

---

## Instruções Gerais de Configuração

Como cada projeto é independente, você deve navegar até a pasta do projeto específico para instalar suas dependências e executar os scripts. 1. **Clone o repositório:**
```bash
git clone https://github.com/wesleymsqt/project-automations.git
cd project-automations
```

2. **Navegue até o projeto desejado:**
```bash
cd robo_StudySelection
```

3. **Instale as dependências para esse projeto específico:**
```bash
npm install
```

4. **Configure as variáveis ​​de ambiente:**
Crie um arquivo `.env` dentro da pasta do projeto específico (por exemplo, `robo_StudySelection/.env`) seguindo as instruções contidas no arquivo README desse projeto.

## Observação sobre Segurança

**Nunca faça o commit de arquivos `.env`.** O arquivo `.gitignore` global na raiz deste repositório está configurado para ignorar arquivos `**/.env`, garantindo que suas senhas, chaves de API e URLs sensíveis permaneçam seguras em sua máquina local.

## Licença

Sinta-se à vontade para usar e adaptar estes scripts para suas próprias necessidades de automação!