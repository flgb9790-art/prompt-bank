export function getPinterestEnvironment(input: string) {
  const apiBaseUrl = input.trim().replace(/\/+$/, "");
  if (apiBaseUrl === "https://api.pinterest.com/v5") return { apiBaseUrl, name: "production" as const };
  if (apiBaseUrl === "https://api-sandbox.pinterest.com/v5") return { apiBaseUrl, name: "sandbox" as const };
  throw new Error("Укажите официальный адрес Pinterest API: production или Sandbox.");
}

export function requirePinterestEnvironment(savedApiBaseUrl: string, currentApiBaseUrl: string): void {
  if (savedApiBaseUrl !== currentApiBaseUrl) {
    throw new Error("Среда Pinterest изменилась. Подключите аккаунт заново в настройках и выберите доску этой среды.");
  }
}
