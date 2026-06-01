import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.VITE_BACKEND_URL?.trim();
  const buildStamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

  return {
  plugins: [
    react(),
    {
      name: "inject-backend-preconnect",
      transformIndexHtml(html) {
        let next = html;
        if (backendUrl) {
          try {
            const origin = new URL(backendUrl).origin;
            const tag = `<link rel="preconnect" href="${origin}" crossorigin />\n    `;
            next = next.replace("<head>", `<head>\n    ${tag}`);
          } catch {
            // ignore invalid backend URL
          }
        }

        const botUsername =
          env.VITE_TELEGRAM_BOT_USERNAME?.trim()?.replace(/^@/, "") || "prmtb_bot";
        const redirectScript = `
    <script>
      (function () {
        try {
          var webApp = window.Telegram && window.Telegram.WebApp;
          if (webApp && (webApp.initData || webApp.initDataUnsafe && webApp.initDataUnsafe.start_param)) return;
          if (webApp && webApp.platform && webApp.platform !== "unknown" && webApp.platform !== "web") return;
          if (!/Telegram/i.test(navigator.userAgent || "")) return;
          var params = new URLSearchParams(window.location.search);
          var hashParams = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
          if (
            params.has("tgWebAppData") ||
            params.has("tgWebAppVersion") ||
            params.has("tgWebAppStartParam") ||
            hashParams.has("tgWebAppData") ||
            hashParams.has("tgWebAppVersion") ||
            hashParams.has("tgWebAppStartParam")
          ) {
            return;
          }
          var prompt = params.get("prompt");
          if (!prompt || !/^\\d+$/.test(prompt)) return;
          window.location.replace(
            "https://t.me/${botUsername}?startapp=" + encodeURIComponent("prompt_" + prompt)
          );
        } catch (e) {}
      })();
    </script>`;
        next = next.replace(
          "</head>",
          `    <meta name="app-build" content="${buildStamp}" />\n${redirectScript}\n  </head>`
        );

        return next;
      }
    },
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "favicon-32x32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "brand-logo.svg"],
      manifest: {
        name: "Prompt Bank",
        short_name: "Prompt Bank",
        theme_color: "#f8f9fd",
        background_color: "#f8f9fd",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,svg,woff2,webmanifest}"],
        skipWaiting: false,
        clientsClaim: true,
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkOnly"
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
