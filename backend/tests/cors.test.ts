import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import cors from "cors";
import { createApiCorsOptions } from "../src/cors";

const trustedOrigins = [
  "https://prompt-bank.one",
  "https://api.prompt-bank.one",
  "https://diplomatic-communication-production-6b54.up.railway.app"
];
const requestHeaders = {
  "Content-Type": "application/json",
  "x-telegram-init-data": "auth_date=1&hash=invalid"
};

async function withApi(
  run: (base: string) => Promise<void>,
  urls = trustedOrigins,
  development = false
) {
  const app = express();
  app.use(cors(createApiCorsOptions(urls, development)));
  app.get("/api/bootstrap", (_req, res) => {
    res.json({ prompts: { items: [{ id: 1 }], total: 1 }, me: { authenticated: false } });
  });
  // A public origin is not an authentication credential.
  app.get("/api/protected", (_req, res) => res.status(401).json({ error: "AUTH_REQUIRED" }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

function preflight(base: string, origin: string) {
  return fetch(`${base}/api/bootstrap`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "content-type,x-telegram-init-data"
    },
    signal: AbortSignal.timeout(5000)
  });
}

test("configured URLs become unique HTTP(S) origins and credentials stay enabled", () => {
  const options = createApiCorsOptions([
    " https://PROMPT-BANK.ONE/library/?page=2#reader ",
    "https://prompt-bank.one/",
    "https://api.prompt-bank.one:443/api/",
    "https://diplomatic-communication-production-6b54.up.railway.app/config.js",
    "", "not a URL", "//relative.example", "file:///tmp/config", "data:text/plain,example", "javascript:alert(1)"
  ]);
  assert.deepEqual(options.origin, trustedOrigins);
  assert.equal(options.credentials, true);
});

for (const origin of trustedOrigins) {
  test(`bootstrap and Telegram preflight allow the exact trusted origin ${origin}`, async () => {
    await withApi(async base => {
      const options = await preflight(base, origin);
      assert.equal(options.status, 204);
      assert.equal(options.headers.get("access-control-allow-origin"), origin);
      assert.equal(options.headers.get("access-control-allow-credentials"), "true");
      assert.ok(options.headers.get("access-control-allow-methods")?.split(",").includes("GET"));
      const allowedHeaders = options.headers.get("access-control-allow-headers")?.toLowerCase().split(/\s*,\s*/);
      assert.ok(allowedHeaders?.includes("content-type"));
      assert.ok(allowedHeaders?.includes("x-telegram-init-data"));
      const response = await fetch(`${base}/api/bootstrap`, { headers: { Origin: origin, ...requestHeaders } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("access-control-allow-origin"), origin);
      assert.equal(response.headers.get("access-control-allow-credentials"), "true");
      assert.equal((await response.json()).prompts.items.length, 1);
    });
  });
}

for (const origin of [
  "https://untrusted.example",
  "https://preview.prompt-bank.one",
  "https://prompt-bank.one.untrusted.example",
  "http://prompt-bank.one"
]) {
  test(`untrusted host or scheme receives no CORS permission: ${origin}`, async () => {
    await withApi(async base => {
      const options = await preflight(base, origin);
      assert.equal(options.headers.get("access-control-allow-origin"), null);
      const response = await fetch(`${base}/api/bootstrap`, { headers: { Origin: origin, ...requestHeaders } });
      assert.equal(response.status, 200); // Public data exists; browsers enforce the absent CORS permission.
      assert.equal(response.headers.get("access-control-allow-origin"), null);
      await response.json();
    });
  });
}

test("a trusted origin cannot turn a protected unauthenticated response into success", async () => {
  await withApi(async base => {
    const response = await fetch(`${base}/api/protected`, { headers: { Origin: trustedOrigins[0] } });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("access-control-allow-origin"), trustedOrigins[0]);
    assert.deepEqual(await response.json(), { error: "AUTH_REQUIRED" });
  });
});

test("requests without an Origin header can still use the health endpoint", async () => {
  await withApi(async base => {
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.deepEqual(await response.json(), { ok: true });
  });
});

test("localhost development origins are excluded in production even when configured", async () => {
  const localhostOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
  await withApi(async base => {
    for (const origin of localhostOrigins) {
      assert.equal((await preflight(base, origin)).headers.get("access-control-allow-origin"), null);
    }
  }, [...trustedOrigins, ...localhostOrigins]);
});

test("development enables only the supplied origins and the two local Vite origins", async () => {
  await withApi(async base => {
    for (const origin of ["http://localhost:5173", "http://127.0.0.1:5173"]) {
      assert.equal((await preflight(base, origin)).headers.get("access-control-allow-origin"), origin);
    }
    for (const origin of ["http://localhost:4173", "http://127.0.0.1:4173", "https://untrusted.example"]) {
      assert.equal((await preflight(base, origin)).headers.get("access-control-allow-origin"), null);
    }
  }, trustedOrigins, true);
});
