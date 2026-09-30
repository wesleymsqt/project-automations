# Robo Study Selection - Parsifal Automation

Este projeto é um conjunto de scripts de automação web desenvolvidos em **Node.js** utilizando a biblioteca **Puppeteer**. Seu objetivo é automatizar a fase de "Study Selection" (Seleção de Estudos) em Revisões Sistemáticas da Literatura (SLR) na plataforma [Parsifal](https://parsif.al/).

O projeto oferece diferentes abordagens para realizar a classificação (individual ou em lote) baseando-se em um arquivo de texto local (`artigos.csv`), além de um sistema de auditoria para garantir a integridade dos dados finais.

## Preparação de Dados (Muito Importante)

Para garantir a agilidade e a precisão de qualquer um dos scripts de automação, é estritamente necessário realizar um pré-processamento na sua base de dados antes de exportar o arquivo CSV. **Certifique-se de ter eliminado previamente:**
- Artigos duplicados.
- Revisões (reviews) que não se aplicam aos critérios.
- Entradas sem título ou com dados corrompidos.
Realizar essa limpeza otimiza drasticamente o tempo de execução e evita que o robô trave ou gere falsos positivos.

