import React from "react";
import { Link } from "react-router-dom";
import { IconSupport } from "../../components/Icons";
import { execCardClass, execHeaderClass } from "../../constants/designTokens";

export default function Support() {
  return (
    <div className="pageContent settings-page-content">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>Support</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
              Get help from Numio support or the community.
            </p>
          </div>
        </div>

        {/* Centered contact support card */}
        <div
          className="flex flex-col items-center justify-center"
          style={{ minHeight: "320px", marginBottom: "48px" }}
        >
          <section
            className="bg-white border rounded-2xl p-8 shadow-sm"
            style={{
              borderColor: "var(--border)",
              maxWidth: "56rem",
              width: "100%",
            }}
          >
            <div className="flex justify-center mb-4">
              <span
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                <IconSupport className="icon icon--large" />
              </span>
            </div>
            <h2 className="text-xl font-semibold text-center mb-2" style={{ color: "var(--text)" }}>
              Contact Support
            </h2>
            <p className="text-sm text-center mb-6" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
              We’re here to help with billing, integrations, cost optimization, or product questions. Email us or join the Slack community and post in <strong>#support</strong>.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
              <a href="mailto:support@numio.ai" className="btn btn--primary">
                Email support@numio.ai
              </a>
              <a href="#" className="btn btn--outline">
                Join Slack Community
              </a>
            </div>
          </section>
        </div>

        {/* Related information */}
        <section className={execCardClass} style={{ borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}>
          <p className={execHeaderClass}>SUPPORT INFO</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>Support hours</h3>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Monday–Friday, 9:00 AM–6:00 PM PT. We aim to respond to email within one business day. Urgent issues can be posted in Slack for faster visibility.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>When you contact us</h3>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Include your workspace name, a short description of the issue, and any relevant report or resource IDs. For billing questions, mention your plan and last four digits of the payment method if needed.
              </p>
            </div>
          </div>
          <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>Other resources</h3>
            <ul className="text-sm space-y-1" style={{ color: "var(--text-secondary)" }}>
              <li>
                <Link to="/inbox" className="link">Inbox</Link> — Check spend and alerts before reaching out.
              </li>
              <li>
                <Link to="/settings" className="link">Settings</Link> — Billing, integrations, and API tokens.
              </li>
              <li>
                <a href="#" className="link">Product documentation</a> — Guides and API reference (opens in new tab).
              </li>
            </ul>
          </div>
        </section>
    </div>
  );
}
