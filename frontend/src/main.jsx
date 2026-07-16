import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { BudgetProvider } from "./context/BudgetContext";
import "./styles/tokens.css";
import "./styles/design-system.css";
import "./styles.css";
import "./numio-design-system.css";

class AppErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("App error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 600 }}>
          <h1 style={{ color: "#b91c1c" }}>Something went wrong</h1>
          <pre style={{ overflow: "auto", background: "#fef2f2", padding: 16, borderRadius: 8 }}>
            {this.state.error?.message ?? String(this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BudgetProvider>
        <App />
      </BudgetProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);

