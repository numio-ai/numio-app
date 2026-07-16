import React from "react";
import { Link } from "react-router-dom";
import { IconNumioMark } from "./Icons";

const linkStyle = { color: "var(--text-secondary)", textDecoration: "none", fontWeight: 500 };

export default function Footer() {
  return (
    <footer className="siteFooter" aria-label="Site footer">
      <div className="siteFooter__inner">
        <div className="siteFooter__brand">
          <div className="siteFooter__logo">
            <IconNumioMark className="siteFooter__logoIcon" />
          </div>
          <nav
            className="footer-links"
            aria-label="Footer navigation"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              fontSize: "var(--text-sm)",
              color: "var(--text-tertiary)",
            }}
          >
            <Link to="/inbox" style={linkStyle} className="siteFooter__link">
              Inbox
            </Link>
            <span className="siteFooter__separator" style={{ color: "var(--border)" }} aria-hidden>|</span>
            <Link to="/settings" style={linkStyle} className="siteFooter__link">
              Settings
            </Link>
            <span className="siteFooter__separator" style={{ color: "var(--border)" }} aria-hidden>|</span>
            <Link to="/account/profile/support" style={linkStyle} className="siteFooter__link">
              Support
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
