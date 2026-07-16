import React from "react";
import { Link } from "react-router-dom";

export default function SetupCTA({ message = "No cost data yet." }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-8 px-4 rounded-lg border"
      style={{ borderColor: "var(--border)", background: "var(--bg-inset)", textAlign: "center" }}
    >
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>{message}</p>
      <Link
        to="/settings?tab=integrations"
        className="btn btn--primary btn--sm"
        style={{ textDecoration: "none" }}
      >
        Connect your AWS account to get started &rarr;
      </Link>
    </div>
  );
}
