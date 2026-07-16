import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRole, ROLES } from "../context/RoleContext";

const ROLE_ACCENT = {
  finance: "#3B5BDB",
  technical: "#7c3aed",
  data: "#0d9488",
};

export default function RoleSwitcher() {
  const { role: current, setRole, roleId } = useRole();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const ref = useRef(null);
  const dropdownRef = useRef(null);
  const accent = ROLE_ACCENT[roleId] || ROLE_ACCENT.finance;

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => {
      if (e.key === "Escape") close();
    };
    const handleClickOutside = (e) => {
      const insideTrigger = ref.current?.contains(e.target);
      const insideDropdown = dropdownRef.current?.contains(e.target);
      if (!insideTrigger && !insideDropdown) {
        requestAnimationFrame(close);
      }
    };
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  useEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 6, left: rect.right - 200 });
    }
  }, [open]);

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      className="role-switcher-dropdown"
      role="listbox"
      aria-label="Viewing as"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: 200,
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        padding: 6,
        zIndex: 10000,
      }}
    >
          <div
            className="role-switcher-dropdown__label"
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: "var(--text-tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              padding: "6px 8px 4px",
            }}
          >
            Viewing as
          </div>
          <div className="role-switcher-dropdown__divider" style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
          {ROLES.map((r) => {
            const isActive = roleId === r.id;
            return (
              <div
                key={r.id}
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  setRole(r.id);
                  requestAnimationFrame(close);
                }}
                className={`role-switcher-dropdown__option${isActive ? " role-switcher-dropdown__option--active" : ""}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "7px 8px",
                  borderRadius: 7,
                  cursor: "pointer",
                  background: isActive ? "var(--pill-active-bg)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "var(--bg-muted)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                  }}
                >
                  {isActive ? "✓ " : ""}
                  {r.label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    marginTop: 2,
                  }}
                >
                  {r.sublabel}
                </span>
              </div>
            );
          })}
    </div>
  ) : null;

  return (
    <>
      <div ref={ref} style={{ position: "relative" }}>
        <button
          type="button"
          className="slim-top-bar__role-btn"
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            height: "36px",
            padding: "0 12px 0 10px",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text-primary)",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            cursor: "pointer",
            transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
            borderLeftWidth: "3px",
            borderLeftColor: accent,
            boxShadow: open ? "0 0 0 2px rgba(59,91,219,0.2)" : "none",
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Viewing as ${current.label}. Change role`}
        >
          <span>{current.short}</span>
          <span style={{ color: "var(--text-muted)", lineHeight: 1, fontSize: 10 }}>▾</span>
        </button>
      </div>
      {dropdown && createPortal(dropdown, document.body)}
    </>
  );
}
