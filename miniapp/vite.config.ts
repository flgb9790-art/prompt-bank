import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [],
      manifest: {
        name: "Prompt Bank",
        short_name: "Prompt Bank",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: []
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            if (id.includes("/WebApp") || id.includes("\\WebApp")) {
              return "web-app";
            }
            return;
          }
          if (id.includes("react-dom") || id.includes("/react/")) {
            return "react-vendor";
          }
          if (id.includes("lucide-react")) {
            return "icons";
          }
        }
      }
    }
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true
      },
      "/uploads": {
        target: "http://localhost:3001",
        changeOrigin: true
      }
    }
  }
});
