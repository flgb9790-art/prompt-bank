import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { setupApiPreconnect } from "./utils/preconnect";
import { markAppSplashVisible, hideAppSplash } from "./utils/appSplash";
import { registerWebPwa } from "./utils/pwa";
import { maybeRedirectTelegramBrowserToMiniApp, migrateLegacyPromptQueryToPath } from "./utils/promptShare";
import "./styles.css";

export { hideAppSplash };

const telegramBotUsername = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.trim();

if (!maybeRedirectTelegramBrowserToMiniApp(telegramBotUsername)) {
  migrateLegacyPromptQueryToPath();
  markAppSplashVisible();
  setupApiPreconnect();
  registerWebPwa();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
