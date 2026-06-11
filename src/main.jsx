import React from "react";
import { createRoot } from "react-dom/client";
import BaufinanzierungsSimulator from "./BaufinanzierungsSimulator.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BaufinanzierungsSimulator />
  </React.StrictMode>
);
