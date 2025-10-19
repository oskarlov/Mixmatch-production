import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: "../../",
  server: {
    // listen on all interfaces (useful in Docker/proxies/ngrok)
    host: true,

    // allow your public dev hosts to connect (plus a wildcard for future ngrok URLs)
    allowedHosts: [
      "halting-unsheltering-christa.ngrok-free.dev",
      "snubbingly-projective-chadwick.ngrok-free.dev",
      "carmella-hypsometric-justa.ngrok-free.dev",
      ".ngrok-free.dev",
      "localhost",
      "https://unpacific-abdiel-nonrevoltingly.ngrok-free.dev"
    ],

    // HMR over HTTPS tunnels: use WSS + port 443
    hmr: {
      protocol: "wss",
      clientPort: 443,
      // OPTIONAL but sometimes needed:
      // host: "your-current-ngrok-subdomain.ngrok-free.dev",
    },

    // Proxies into your server container (Socket.IO + optional /media)
    proxy: {
      "/socket.io": {
        target: "http://server:8080", // Docker service name, not localhost
        changeOrigin: true,
        ws: true,
      },
      "/media": {
        target: "http://server:8080",
        changeOrigin: true,
      },
    },
  },
  cacheDir: "/tmp/vite-hub",
});
