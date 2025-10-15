import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' 
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Server is for setting up ngrok tunnel for localhost. Only needed before deployment.
  server: {
    host: true, // listen on all interfaces (needed behind proxies/tunnels)
    allowedHosts: ['halting-unsheltering-christa.ngrok-free.dev'], // <- your ngrok host
    hmr: { clientPort: 443 }, // helps HMR over HTTPS tunnels
  },
})
