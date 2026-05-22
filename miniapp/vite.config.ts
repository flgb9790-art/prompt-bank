import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_BACKEND_URL?.trim();

  return {
  plugins: [
    react(),
    {
      name: "inject-backend-preconnect",
      transformIndexHtml(html) {
        if (!backendUrl) return html;
        try {
          const origin = new URL(backendUrl).origin;
          const tag = `<link rel="preconnect" href="${origin}" crossorigin />\n    `;
          return html.replace("<head>", `<head>\n    ${tag}`);
        } catch {
          return html;
        }
      }
    },
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
        mode: "development",
        globPatterns: ["**/*.{js,css,svg,woff2,webmanifest}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-pages",
              networkTimeoutSeconds: 3
            }
          }
        ]
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
};
});
