import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    allowedHosts: [
      'digital-therapy-app-tunnel-k0suh20y.devinapps.com',
      'digital-therapy-app-tunnel-kqba4qs7.devinapps.com',
      'digital-therapy-app-tunnel-qkdfjhu7.devinapps.com'
    ]
  },
})

