import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

const rootElement = document.getElementById("root");

if (rootElement) {
  document.documentElement.lang = "ar";
  document.documentElement.dir = "rtl";

  createRoot(rootElement).render(<App />);
}
