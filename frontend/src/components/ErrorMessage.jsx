/**
 * Shared error message with optional retry button.
 * Replaces inline ErrorMessage helpers across pages.
 */
export default function ErrorMessage({ message, onRetry }) {
  const display =
    message && message.includes("unexpected")
      ? "Unable to load data — the backend may not have data yet."
      : message || "Something went wrong.";

  return (
    <div
      style={{
        borderRadius: "var(--radius-lg, 12px)",
        border: "1px solid var(--danger, #dc2626)",
        background: "var(--danger-bg, #fef2f2)",
        padding: "16px 20px",
      }}
    >
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--danger, #dc2626)",
          margin: 0,
        }}
      >
        {display}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 12,
            fontSize: 12,
            fontWeight: 500,
            color: "var(--danger, #dc2626)",
            background: "transparent",
            border: "1px solid var(--danger, #dc2626)",
            borderRadius: "var(--radius-sm, 6px)",
            padding: "5px 14px",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
