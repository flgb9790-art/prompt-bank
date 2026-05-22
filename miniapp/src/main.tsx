import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { setupApiPreconnect } from "./utils/preconnect";
import { markAppSplashVisible, hideAppSplash } from "./utils/appSplash";
import { registerWebPwa } from "./utils/pwa";
import "./styles.css";

markAppSplashVisible();
setupApiPreconnect();
registerWebPwa();

export { hideAppSplash };

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
