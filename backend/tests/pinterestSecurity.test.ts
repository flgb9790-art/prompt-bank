import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { config } from "../src/config";
import { prisma } from "../src/db";
import { readTelegramId, verifyTelegramIdentity } from "../src/auth";
import router from "../src/routes/pinterest.routes";
import { signedHeaders } from "./telegramTestIdentity";
import { encryptToken, decryptToken, getPinterestCredentials, connectionStatus, saveConnection } from "../src/services/pinterestConnection.service";
import { buildPinterestAuthUrl } from "../src/services/pinterestOAuth.service";

const realFetch = global.fetch;
const originalConfig = { ...config };
let states = new Map<string, any>();
let connection: any = null;
let calls: string[] = [];
let afterTokenRequest: (() => void) | undefined;
const fullScope = "boards:read,boards:write,pins:read,pins:write";
let tokenScope: string | undefined;
beforeEach(() => {
  Object.assign(config, { botToken: "test-bot", telegramBotToken: "test-bot", adminTelegramIds: ["42"],
    pinterestTokenEncryptionKey: "ab".repeat(32), pinterestClientId: "client", pinterestClientSecret: "secret",
    pinterestRedirectUri: "https://backend.example/api/pinterest/callback", webAppUrl: "https://app.example",
    pinterestAccessToken: "legacy-token", pinterestBoardId: "100" });
  states = new Map(); connection = null; calls = []; afterTokenRequest = undefined; tokenScope = fullScope;
  Object.assign(prisma.pinterestOAuthState, {
    findUnique: async ({where}: any) => states.get(where.stateHash) || null,
    create: async ({data}: any) => { states.set(data.stateHash, data); return data; },
    deleteMany: async ({where}: any = {}) => {
      let count = 0;
      for (const [key, row] of states) {
        if (!where || where.OR || (!where.stateHash || key === where.stateHash) &&
          (!where.ownerTelegramId || row.ownerTelegramId === where.ownerTelegramId) &&
          (!where.expiresAt?.gt || row.expiresAt > where.expiresAt.gt)) { states.delete(key); count++; }
      }
      return {count};
    }
  });
  Object.assign(prisma.pinterestConnection, {
    findUnique: async () => connection,
    findUniqueOrThrow: async () => { assert.ok(connection); return connection; },
    upsert: async ({create,update}: any) => { connection = connection ? {...connection,...update} : create; return connection; },
    update: async ({data}: any) => { connection = {...connection,...data}; return connection; },
    updateMany: async ({where,data}: any) => {
      if (connection?.accessTokenEncrypted !== where.accessTokenEncrypted) return {count:0};
      connection = {...connection,...data}; return {count:1};
    }
  });
  (prisma as any).$transaction = async (input: any) => typeof input === "function" ? input(prisma) : Promise.all(input);
  global.fetch = (async (url: any) => {
    calls.push(String(url));
    if (String(url).includes("/oauth/token")) {
      afterTokenRequest?.();
      return new Response(JSON.stringify({ access_token: "new-private-access", refresh_token: "new-private-refresh", expires_in: 3600, scope: tokenScope }));
    }
    if (String(url).includes("/boards/100")) return new Response(JSON.stringify({id:"100",name:"Ideas"}));
    if (String(url).includes("/boards?")) return new Response(JSON.stringify({items:[{id:"100",name:"Ideas",secret:"do-not-return"}],bookmark:null}));
    throw new Error("Unexpected request");
  }) as typeof fetch;
});
after(() => { global.fetch = realFetch; Object.assign(config, originalConfig); });

async function app(run: (base: string) => Promise<void>) {
  const instance = express(); instance.use(express.json()); instance.use("/api/pinterest", router);
  instance.use((err: Error, _req: any, res: any, _next: any) => res.status(500).json({message:err.message}));
  const server = instance.listen(0, "127.0.0.1"); await once(server,"listening");
  try { await run(`http://127.0.0.1:${(server.address() as any).port}`); }
  finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}
async function start(base: string) {
  const response = await realFetch(`${base}/api/pinterest/connect`, { method:"POST",headers:signedHeaders() });
  assert.equal(response.status,200);
  const {url} = await response.json();
  const authorize = new URL(url);
  assert.equal(authorize.origin, new URL(config.pinterestRedirectUri).origin);
  assert.equal(authorize.pathname,"/api/pinterest/authorize");
  const transition = await realFetch(`${base}${authorize.pathname}${authorize.search}`,{redirect:"manual"});
  assert.equal(transition.status,303);
  assert.equal(new URL(transition.headers.get("location")!).origin,"https://www.pinterest.com");
  return {state:authorize.searchParams.get("state")!,cookie:transition.headers.get("set-cookie")!.split(";")[0]};
}

test("forged ID, altered initData and expired signed data cannot authenticate", () => {
  assert.equal(readTelegramId({header:(name: string) => name === "x-telegram-id" ? "42" : undefined} as any),null);
  const data = signedHeaders()["x-telegram-init-data"];
  assert.equal(verifyTelegramIdentity(data),"42");
  assert.equal(verifyTelegramIdentity(data.replace("42","43")),null);
  assert.equal(verifyTelegramIdentity(signedHeaders("42",86401)["x-telegram-init-data"]),null);
  assert.equal(verifyTelegramIdentity(`${data}&auth_date=1`),null);
  assert.equal(verifyTelegramIdentity(signedHeaders("42",-120)["x-telegram-init-data"]),null);
});
test("Telegram Login Widget signature is checked with the separate widget algorithm", () => {
  const data = {id:"42",first_name:"Антон",auth_date:String(Math.floor(Date.now()/1000))};
  const secret = createHash("sha256").update(config.telegramBotToken).digest();
  const hash = createHmac("sha256",secret).update(Object.keys(data).sort().map(key=>`${key}=${data[key as keyof typeof data]}`).join("\n")).digest("hex");
  assert.equal(verifyTelegramIdentity(undefined,encodeURIComponent(JSON.stringify({...data,hash}))),"42");
  assert.equal(verifyTelegramIdentity(undefined,encodeURIComponent(JSON.stringify({...data,id:"43",hash}))),null);
});
test("tokens are authenticated ciphertext and OAuth requests the four scopes required by POST /pins", () => {
  const encrypted = encryptToken("private-value");
  assert.equal(decryptToken(encrypted),"private-value");
  assert.ok(!encrypted.includes("private-value"));
  const parts = encrypted.split("."); parts[1] = Buffer.alloc(16).toString("base64url");
  assert.throws(()=>decryptToken(parts.join(".")));
  const url = new URL(buildPinterestAuthUrl("one-time-state"));
  assert.equal(url.searchParams.get("state"),"one-time-state");
  assert.equal(url.searchParams.get("scope"),"boards:read,boards:write,pins:read,pins:write");
});

test("every required scope must be granted before replacing a connection or consuming OAuth state", async () => {
  await app(async base => {
    for (const missing of fullScope.split(",")) {
      await start(base);
      const stateHash = [...states.keys()][0];
      await assert.rejects(saveConnection("42", {
        access_token:"rejected-private-access", scope:fullScope.split(",").filter(scope => scope !== missing).join(",")
      }, stateHash), error => error instanceof Error && error.message.includes(missing));
      assert.equal(connection,null);
      assert.ok(states.has(stateHash));
    }
    await assert.rejects(saveConnection("42", {access_token:"unverified-scopes"}, [...states.keys()][0]), /Не хватает разрешений/);
    assert.equal(connection,null);
  });
});

test("OAuth callback rejects the old two-scope grant with a reconnect instruction", async () => {
  tokenScope = "boards:read,pins:write";
  await app(async base => {
    const {state,cookie} = await start(base);
    const response = await realFetch(`${base}/api/pinterest/callback?state=${state}&code=partial-grant`, {headers:{cookie}});
    assert.equal(response.status,400);
    const html = await response.text();
    assert.match(html,/boards:write, pins:read/);
    assert.match(html,/Подключите аккаунт заново/);
    assert.ok(!html.includes("new-private"));
    assert.equal(connection,null);
  });
});

test("old or unknown stored scopes require reconnect before any API request or token refresh", async () => {
  connection = {id:"publisher",accessTokenEncrypted:encryptToken("access"),refreshTokenEncrypted:encryptToken("refresh"),
    scope:"boards:read,pins:write",expiresAt:new Date(0),boardId:"100",boardName:"Ideas"};
  await app(async base => {
    const response = await realFetch(`${base}/api/pinterest/status`,{headers:signedHeaders()});
    const status = await response.json();
    assert.equal(status.connected,true);
    assert.equal(status.needsReconnect,true);
    assert.deepEqual(status.missingScopes,["boards:write","pins:read"]);
    assert.equal(status.boardId,"100");
  });
  await assert.rejects(getPinterestCredentials(),/boards:write, pins:read.*Подключите аккаунт заново/);
  assert.equal(calls.length,0);
  connection.scope = null;
  assert.deepEqual((await connectionStatus()).missingScopes,fullScope.split(","));
  await assert.rejects(getPinterestCredentials(),/Не хватает разрешений/);
  connection.scope = " boards:read boards:write\npins:read,pins:write ";
  connection.expiresAt = new Date(Date.now()+3600000);
  assert.equal((await connectionStatus()).needsReconnect,false);
  assert.equal((await getPinterestCredentials()).accessToken,"access");
  assert.equal(calls.length,0);
});
test("OAuth endpoints reject guests, forged admins, and non-admin users", async () => {
  await app(async base => {
    for (const path of ["status","boards"]) {
      assert.equal((await realFetch(`${base}/api/pinterest/${path}`,{headers:{"x-telegram-id":"42"}})).status,401);
      assert.equal((await realFetch(`${base}/api/pinterest/${path}`,{headers:signedHeaders("43")})).status,403);
    }
    assert.equal(calls.length,0);
  });
});
test("OAuth binds to the browser, saves encrypted tokens, redirects without secrets, and rejects replay", async () => {
  await app(async base => {
    const {state,cookie} = await start(base);
    const callback = `${base}/api/pinterest/callback?state=${state}&code=example-code`;
    assert.equal((await realFetch(callback,{redirect:"manual"})).status,400);
    assert.equal((await realFetch(callback,{headers:{cookie:"pb_pinterest_oauth=wrong-browser"},redirect:"manual"})).status,400);
    assert.equal(calls.length,0);
    const response = await realFetch(callback,{headers:{cookie},redirect:"manual"});
    assert.equal(response.status,303);
    assert.equal(response.headers.get("location"),"https://app.example/settings?pinterest=connected");
    assert.equal(decryptToken(connection.accessTokenEncrypted),"new-private-access");
    assert.equal(decryptToken(connection.refreshTokenEncrypted),"new-private-refresh");
    assert.ok(!(await response.text()).includes("new-private"));
    assert.equal((await realFetch(callback,{headers:{cookie},redirect:"manual"})).status,400);
    assert.equal(calls.length,1);
    const status = await realFetch(`${base}/api/pinterest/status`,{headers:signedHeaders()});
    assert.ok(!(await status.text()).includes("new-private"));
  });
});
test("expired or declined authorization never stores tokens", async () => {
  await app(async base => {
    let flow = await start(base);
    for (const row of states.values()) row.expiresAt = new Date(0);
    assert.equal((await realFetch(`${base}/api/pinterest/callback?state=${flow.state}&code=x`,{headers:{cookie:flow.cookie}})).status,400);
    flow = await start(base);
    assert.equal((await realFetch(`${base}/api/pinterest/callback?state=${flow.state}&error=access_denied`,{headers:{cookie:flow.cookie}})).status,400);
    assert.equal(states.size,0); assert.equal(connection,null); assert.equal(calls.length,0);
  });
});

test("missing encryption configuration blocks OAuth before a redirect is created", async () => {
  config.pinterestTokenEncryptionKey = "";
  await app(async base => {
    const response = await realFetch(`${base}/api/pinterest/connect`,{method:"POST",headers:signedHeaders()});
    assert.equal(response.status,500); assert.equal(states.size,0); assert.equal(calls.length,0);
  });
});
test("disconnect deletes credentials, cancels pending OAuth, and blocks environment fallback", async () => {
  await app(async base => {
    await start(base);
    const response = await realFetch(`${base}/api/pinterest/connection`,{method:"DELETE",headers:signedHeaders()});
    assert.equal(response.status,200); assert.equal(states.size,0);
    await assert.rejects(getPinterestCredentials(),/отключён/);
    await assert.rejects(saveConnection("42",{access_token:"late-token",scope:fullScope},"removed-state"),/отменено/);
    assert.equal(connection.accessTokenEncrypted,null);
    assert.equal((await connectionStatus()).legacyConfigured,false);
    assert.equal((await connectionStatus()).needsReconnect,false);
    assert.deepEqual((await connectionStatus()).missingScopes,[]);
  });
});
test("expired access refreshes once and never resurrects a disconnected connection", async () => {
  connection = {id:"publisher",accessTokenEncrypted:encryptToken("old"),refreshTokenEncrypted:encryptToken("refresh"),scope:fullScope,expiresAt:new Date(0),boardId:"100",boardName:"Ideas"};
  const result = await Promise.all([getPinterestCredentials(),getPinterestCredentials()]);
  assert.equal(calls.length,1); assert.equal(result[0].accessToken,"new-private-access");
  connection.expiresAt = new Date(0);
  afterTokenRequest = () => {connection = {...connection,accessTokenEncrypted:null,refreshTokenEncrypted:null};};
  await assert.rejects(getPinterestCredentials(),/изменилось/);
  assert.equal(connection.accessTokenEncrypted,null);
});

test("refresh preserves omitted scopes and marks reduced permissions for reconnect without replacing credentials", async () => {
  connection = {id:"publisher",accessTokenEncrypted:encryptToken("old"),refreshTokenEncrypted:encryptToken("refresh"),
    scope:fullScope,expiresAt:new Date(0),boardId:"100",boardName:"Ideas"};
  tokenScope = undefined;
  assert.equal((await getPinterestCredentials()).accessToken,"new-private-access");
  assert.equal(connection.scope,fullScope);
  const previousAccess = connection.accessTokenEncrypted;
  const previousRefresh = connection.refreshTokenEncrypted;
  connection.expiresAt = new Date(0);
  tokenScope = "boards:read,pins:write";
  await assert.rejects(getPinterestCredentials(),/boards:write, pins:read.*Подключите аккаунт заново/);
  assert.equal(connection.accessTokenEncrypted,previousAccess);
  assert.equal(connection.refreshTokenEncrypted,previousRefresh);
  assert.equal(connection.scope,tokenScope);
  assert.equal((await connectionStatus()).needsReconnect,true);
  assert.deepEqual((await connectionStatus()).missingScopes,["boards:write","pins:read"]);
});

test("a reduced-scope refresh cannot mark a newer OAuth connection as requiring reconnect", async () => {
  connection = {id:"publisher",accessTokenEncrypted:encryptToken("old"),refreshTokenEncrypted:encryptToken("refresh"),
    scope:fullScope,expiresAt:new Date(0),boardId:"100",boardName:"Ideas"};
  tokenScope = "boards:read,pins:write";
  afterTokenRequest = () => {
    connection = {...connection,accessTokenEncrypted:encryptToken("newer-connection"),scope:fullScope,expiresAt:new Date(Date.now()+3600000)};
  };
  await assert.rejects(getPinterestCredentials(),/изменилось/);
  assert.equal((await connectionStatus()).needsReconnect,false);
  assert.deepEqual((await connectionStatus()).missingScopes,[]);
  assert.equal((await getPinterestCredentials()).accessToken,"newer-connection");
});
test("board listing strips private fields and board selection is checked with Pinterest", async () => {
  connection = {id:"publisher",accessTokenEncrypted:encryptToken("access"),scope:fullScope,boardId:null};
  await app(async base => {
    const list = await realFetch(`${base}/api/pinterest/boards`,{headers:signedHeaders()});
    assert.deepEqual(await list.json(),{items:[{id:"100",name:"Ideas"}],bookmark:null});
    const selected = await realFetch(`${base}/api/pinterest/board`,{method:"PUT",headers:{...signedHeaders(),"Content-Type":"application/json"},body:JSON.stringify({boardId:"100"})});
    assert.equal(selected.status,200); assert.equal(connection.boardName,"Ideas");
    assert.ok(calls.some(url=>url.endsWith("/boards/100")));
  });
});
test("PostgreSQL connection patch is additive and idempotent", async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE "Prompt" (id INTEGER PRIMARY KEY, content TEXT); INSERT INTO "Prompt" VALUES (1,\'keep\')');
    const sql = readFileSync("prisma/patches/20261027_pinterest_connection.sql","utf8");
    await db.exec(sql); await db.exec(sql);
    assert.deepEqual((await db.query('SELECT * FROM "Prompt"')).rows,[{id:1,content:"keep"}]);
    await db.exec('INSERT INTO "PinterestConnection" (id,"ownerTelegramId") VALUES (\'publisher\',\'42\')');
  } finally { await db.close(); }
});
