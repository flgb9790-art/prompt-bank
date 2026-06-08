import { Router } from "express";
import {
  buildPinterestAuthUrl,
  exchangePinterestOAuthCode,
  renderPinterestOAuthHtml
} from "../services/pinterestOAuth.service";

const router = Router();

function wantsJson(req: { accepts: (types: string[]) => string | false }): boolean {
  return req.accepts(["json", "html"]) === "json";
}

router.get("/auth-url", (_req, res, next) => {
  try {
    const url = buildPinterestAuthUrl();
    res.json({ url });
  } catch (error) {
    next(error);
  }
});

router.get("/callback", async (req, res) => {
  try {
    const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
    const oauthError = typeof req.query.error === "string" ? req.query.error.trim() : "";

    if (oauthError) {
      const message = `Pinterest authorization failed: ${oauthError}`;
      if (wantsJson(req)) {
        return res.status(400).json({ error: message });
      }
      return res
        .status(400)
        .type("html")
        .send(
          renderPinterestOAuthHtml({
            title: "Ошибка Pinterest OAuth",
            message,
            isError: true
          })
        );
    }

    if (!code) {
      const message = "Pinterest code is missing";
      if (wantsJson(req)) {
        return res.status(400).json({ error: message });
      }
      return res
        .status(400)
        .type("html")
        .send(
          renderPinterestOAuthHtml({
            title: "Ошибка Pinterest OAuth",
            message,
            isError: true
          })
        );
    }

    const token = await exchangePinterestOAuthCode(code);

    if (wantsJson(req)) {
      return res.json({
        message: "Pinterest connected",
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_in: token.expires_in,
        scope: token.scope,
        token_type: token.token_type
      });
    }

    return res.type("html").send(
      renderPinterestOAuthHtml({
        title: "Pinterest подключен",
        message: "Скопируйте access_token и добавьте его в PINTEREST_ACCESS_TOKEN на сервере.",
        fields: [
          { label: "access_token", value: token.access_token },
          ...(token.refresh_token ? [{ label: "refresh_token", value: token.refresh_token }] : []),
          ...(token.scope ? [{ label: "scope", value: token.scope }] : []),
          ...(token.token_type ? [{ label: "token_type", value: token.token_type }] : []),
          ...(token.expires_in !== undefined
            ? [{ label: "expires_in", value: String(token.expires_in) }]
            : [])
        ]
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pinterest OAuth failed";
    if (wantsJson(req)) {
      return res.status(500).json({ error: message });
    }
    return res
      .status(500)
      .type("html")
      .send(
        renderPinterestOAuthHtml({
          title: "Ошибка Pinterest OAuth",
          message,
          isError: true
        })
      );
  }
});

export default router;
