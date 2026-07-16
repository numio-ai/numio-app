import { Component } from "react";

/**
 * Global error boundary — catches unhandled render errors and shows a
 * recovery UI instead of a blank screen.
 *
 * Wrap around <Routes> in App.jsx.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            padding: 40,
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "var(--text-primary, #111827)",
              margin: 0,
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted, #6b7280)",
              marginTop: 8,
              maxWidth: 420,
            }}
          >
            An unexpected error occurred. Try refreshing the page or click below
            to recover.
          </p>
          {this.state.error && (
            <pre
              style={{
                fontSize: 11,
                color: "var(--text-tertiary, #9ca3af)",
                marginTop: 16,
                maxWidth: 500,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              marginTop: 20,
              fontSize: 13,
              fontWeight: 500,
              color: "#fff",
              background: "var(--primary, #3b82f6)",
              border: "none",
              borderRadius: "var(--radius-sm, 6px)",
              padding: "8px 20px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
