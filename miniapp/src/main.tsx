import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { setupApiPreconnect } from "./utils/preconnect";
import "./styles.css";

setupApiPreconnect();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
