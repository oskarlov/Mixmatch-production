import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: '../../',
  server: {
    host: true, // listen on all interfaces (needed behind proxies/tunnels)
    allowedHosts: ['halting-unsheltering-christa.ngrok-free.dev',"snubbingly-projective-chadwick.ngrok-free.dev", "carmella-hypsometric-justa.ngrok-free.dev"], // <- your ngrok host
    hmr: { clientPort: 443 }, // helps HMR over HTTPS tunnels
    host: true,
    allowedHosts: [
      'halting-unsheltering-christa.ngrok-free.dev',
      'snubbingly-projective-chadwick.ngrok-free.dev',
      '.ngrok-free.dev',
    ],
    hmr: {
      clientPort: 443,     // HMR over HTTPS tunnel
      protocol: 'wss',
    },
    proxy: {
      // Socket.IO (WebSocket + polling) → your server container
      '/socket.io': {
        target: 'http://server:8080', // <— Docker service name, not localhost
        changeOrigin: true,
        ws: true,
      },
      // Optional: forward media files served by the server
      '/media': {
        target: 'http://server:8080',
        changeOrigin: true,
      },
    },
  },
  cacheDir: '/tmp/vite-hub',
});
