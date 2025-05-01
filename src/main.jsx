import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // 可选，如果您用 Tailwind 就保留这行

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
