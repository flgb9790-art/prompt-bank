import { createHmac } from "node:crypto";
import { config } from "../src/config";
export function signedHeaders(id = "42", age = 0) {
  const data = { auth_date: String(Math.floor(Date.now() / 1000) - age), user: JSON.stringify({ id: Number(id) }) };
  const check = Object.keys(data).sort().map(key => `${key}=${data[key as keyof typeof data]}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(config.botToken || config.telegramBotToken).digest();
  return { "x-telegram-init-data": new URLSearchParams({ ...data, hash: createHmac("sha256", secret).update(check).digest("hex") }).toString() };
}
