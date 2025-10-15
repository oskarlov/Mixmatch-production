A democratic, music-centered multiplayer quiz game powered by Spotify data.

<<<<<<< HEAD
Öppna 3 gitbash, 
cd till server, hub, player
pnpm dev på varje.
=======
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
   - Hub → http://localhost:5173
   - Player → http://localhost:5174
   
   
   If running on ngrok tunnel use this URL to open hub:
   - Hub → https://halting-unsheltering-christa.ngrok-free.dev 

6. Stop everything:

   Press Ctrl + C in the terminal, then run:

   docker-compose down

Notes:
- Make sure ports 8080, 5173, 5174 are free.
- For live React development (hot reload), run apps locally instead of via Docker.
- Spotify API keys or other secrets should be added via .env if needed.
- Copys are left empty for now
>>>>>>> origin/main
