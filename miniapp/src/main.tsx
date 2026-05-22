import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { setupApiPreconnect } from "./utils/preconnect";
import { noteAppSplashShown, hideAppSplash } from "./utils/appSplash";
import { registerWebPwa } from "./utils/pwa";
import "./styles.css";

noteAppSplashShown();
setupApiPreconnect();
registerWebPwa();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
