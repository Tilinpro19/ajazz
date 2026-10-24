import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// Sin StrictMode: duplicaría los efectos y abriría dos gestores HID sobre el mismo mouse.
createRoot(document.getElementById("root")).render(<App />);
