import { config } from "../config";

const PINTEREST_OAUTH_AUTHORIZE_URL = "https://www.pinterest.com/oauth/";
const PINTEREST_OAUTH_TOKEN_URL = "https://api.pinterest.com/v5/oauth/token";
const PINTEREST_OAUTH_SCOPES = "boards:read,boards:write,pins:read,pins:write";

export type PinterestOAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

function assertOAuthConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = config.pinterestClientId;
  const clientSecret = config.pinterestClientSecret;
  const redirectUri = config.pinterestRedirectUri;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Pinterest OAuth is not configured. Set PINTEREST_CLIENT_ID, PINTEREST_CLIENT_SECRET, and PINTEREST_REDIRECT_URI.");
  }

  return { clientId, clientSecret, redirectUri };
}

export function buildPinterestAuthUrl(): string {
  const { clientId, redirectUri } = assertOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: PINTEREST_OAUTH_SCOPES
  });
  return `${PINTEREST_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangePinterestOAuthCode(code: string): Promise<PinterestOAuthTokenResponse> {
  const { clientId, clientSecret, redirectUri } = assertOAuthConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri
  });

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(PINTEREST_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  let data: PinterestOAuthTokenResponse & { message?: string; code?: number };
  try {
    data = (await response.json()) as PinterestOAuthTokenResponse & { message?: string; code?: number };
  } catch {
    throw new Error("Pinterest OAuth token exchange failed: invalid response");
  }

  if (!response.ok || !data.access_token) {
    const message = data.message || `Pinterest OAuth token exchange failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderPinterestOAuthHtml(input: {
  title: string;
  message: string;
  fields?: Array<{ label: string; value: string }>;
  isError?: boolean;
}): string {
  const fieldsHtml = (input.fields ?? [])
    .map(
      (field) => `
        <div class="field">
          <div class="field-label">${escapeHtml(field.label)}</div>
          <pre class="field-value">${escapeHtml(field.value)}</pre>
        </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f8f9fd;
      color: #101828;
    }
    .wrap {
      max-width: 720px;
      margin: 48px auto;
      padding: 0 16px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e5e9f2;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 8px 24px rgba(16, 24, 40, 0.06);
    }
    h1 {
      margin: 0 0 8px;
      font-size: 24px;
      font-weight: 800;
      color: ${input.isError ? "#b42318" : "#101828"};
    }
    p {
      margin: 0 0 16px;
      font-size: 15px;
      line-height: 1.5;
      color: #475467;
    }
    .field + .field {
      margin-top: 12px;
    }
    .field-label {
      font-size: 13px;
      font-weight: 700;
      color: #344054;
      margin-bottom: 6px;
    }
    .field-value {
      margin: 0;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid #e5e9f2;
      background: #f9fafc;
      font-size: 13px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-all;
      color: #101828;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>${escapeHtml(input.title)}</h1>
      <p>${escapeHtml(input.message)}</p>
      ${fieldsHtml}
    </div>
  </div>
</body>
</html>`;
}
