import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { registerServiceWorker } from "./lib/pwa";

registerServiceWorker();

// FIX #16: ! non-null kaldırıldı — tip güvenli root guard
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
