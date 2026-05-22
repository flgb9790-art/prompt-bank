import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
