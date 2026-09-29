# Project Automations

Welcome to the **Project Automations** repository! This central repository houses a collection of web automation scripts and bots designed to streamline repetitive tasks, improve productivity, and automate data processing using Node.js and various automation libraries.

## Repository Structure

To maintain organization and prevent conflicts between dependencies, each automation tool is contained within its own isolated folder. Each project has its own `package.json`, `node_modules`, and specific setup instructions.

```text
project-automations/
│
├── robo_StudySelection/    # Automation for SLR study selection in Parsifal
├── (future projects...)    # Other bots will be added here
├── .gitignore              # Global git ignore rules (protects all .env files)
└── README.md               # This file
```

## Current Projects

Here is a list of the available automation scripts in this repository:

### 1. [Robo Study Selection](./robo_StudySelection)
A Node.js and Puppeteer script built to automate the "Study Selection" phase of Systematic Literature Reviews (SLR) in the [Parsifal](https://parsif.al/) platform. It reads a local `.csv` file and automatically classifies articles as *Accepted* or *Rejected* on the web interface.
* **Read the full documentation and setup guide here:** [robo_StudySelection/README.md](./robo_StudySelection/README.md)

---

## General Setup Instructions

Since each project is independent, you must navigate into the specific project's folder to install its dependencies and run the scripts.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/wesleymsqt/project-automations.git
   cd project-automations
   ```

2. **Navigate to the desired project:**
   ```bash
   cd robo_StudySelection
   ```

3. **Install dependencies for that specific project:**
   ```bash
   npm install
   ```

4. **Configure environment variables:**
   Create a `.env` file inside the specific project folder (e.g., `robo_StudySelection/.env`) following the instructions in that project's README.

## Security Note

**Never commit `.env` files.** The global `.gitignore` at the root of this repository is configured to ignore `**/.env` files, ensuring that your passwords, API keys, and sensitive URLs remain secure on your local machine.

## License

Feel free to use and adapt these scripts for your own automation needs!