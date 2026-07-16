/**
 * Generic loading spinner for pages that don't need skeleton loaders.
 * Use SkeletonLoader for Overview, Feed, and Recommendations pages.
 */
export default function LoadingSpinner({ message = "Loading…", height = 200 }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height,
        gap: 12,
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          border: "2.5px solid var(--border, #e5e5e5)",
          borderTopColor: "var(--primary, #3b82f6)",
          borderRadius: "50%",
          animation: "numio-spin 0.7s linear infinite",
        }}
      />
      <span style={{ fontSize: 13, color: "var(--text-tertiary, #9ca3af)" }}>
        {message}
      </span>
    </div>
  );
}
