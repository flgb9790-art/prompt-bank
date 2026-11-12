// POST /pins requires all four scopes in Pinterest's API v5 specification.
export const PINTEREST_REQUIRED_SCOPES = ["boards:read", "boards:write", "pins:read", "pins:write"] as const;

export function missingPinterestScopes(scope: string | null | undefined): string[] {
  const granted = new Set(scope?.split(/[\s,]+/).filter(Boolean));
  return PINTEREST_REQUIRED_SCOPES.filter(required => !granted.has(required));
}

export function requirePinterestScopes(scope: string | null | undefined): void {
  const missing = missingPinterestScopes(scope);
  if (missing.length) {
    throw new Error(`Не хватает разрешений Pinterest: ${missing.join(", ")}. Подключите аккаунт заново в настройках.`);
  }
}
