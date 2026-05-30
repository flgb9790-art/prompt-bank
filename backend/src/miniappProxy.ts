import type { Request, Response, NextFunction } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { config } from "./config";
import { urlHostname } from "./utils/telegramWebContent";

function requestHost(req: Request): string {
  return (req.get("x-forwarded-host") ?? req.get("host") ?? "")
    .split(",")[0]
    .trim()
    .replace(/:\d+$/, "")
    .toLowerCase();
}

export function shouldProxyMiniapp(req: Request): boolean {
  const pathname = req.path;
  if (pathname.startsWith("/api") || pathname.startsWith("/uploads")) {
    return false;
  }

  const webHost = urlHostname(config.webAppUrl);
  if (!webHost) {
    return false;
  }

  return requestHost(req) === webHost;
}

const proxy = createProxyMiddleware({
  target: config.miniappProxyUrl,
  changeOrigin: true,
  ws: true,
  on: {
    error(err, _req, res) {
      console.error("[miniapp-proxy]", err.message);
      if ("writeHead" in res && typeof res.writeHead === "function") {
        res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Mini App временно недоступен. Проверьте сервис miniapp в Railway.");
      }
    }
  }
});

export function miniappProxyMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!shouldProxyMiniapp(req)) {
    return next();
  }
  return proxy(req, res, next);
}
