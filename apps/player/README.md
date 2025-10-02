# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

### How to use docker
This guide lets you run MixMatch (server, hub, player) on your computer with **one command**. You do NOT need Node.js, pnpm, or React installed — Docker handles everything.

Prerequisites:
1. Install Docker Desktop: https://www.docker.com/products/docker-desktop
2. Make sure Docker is running.

Quick Start:

1. Open a terminal.
2. Navigate to the project folder:

   cd path/to/MixMatch

3. Run everything:

   docker-compose up --build # Needs to be done everytime we change something with the server

   docker-compose up # Can be used if we only changed frontend etc.

5. Open the apps in your browser:

   - Server → http://localhost:8080
   - Hub → http://localhost:3001
   - Player → http://localhost:3002

6. Stop everything:

   Press Ctrl + C in the terminal, then run:

   docker-compose down

Notes:
- Make sure ports 8080, 3001, 3002 are free.
- For live React development (hot reload), run apps locally instead of via Docker.
- Spotify API keys or other secrets should be added via .env if needed.
- Copys are left empty for now