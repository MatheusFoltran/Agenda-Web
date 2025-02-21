import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./main/app";
import "./style.css";

console.log("1. index.tsx - Iniciando aplicação");

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("Elemento root não encontrado!");
  throw new Error("Elemento #root não encontrado!");
}

console.log("2. index.tsx - Elemento root encontrado, renderizando app");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);