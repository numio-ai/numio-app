import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Inbox,
  DollarSign,
  Server,
  ChevronDown,
  Sun,
  Moon,
  X,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useMobileNav } from "../context/MobileNavContext";

const menuSections = [
  { id: "inbox", label: "Inbox", icon: Inbox, path: "/inbox" },
  {
    id: "usage-cost",
    label: "Usage & Cost",
    icon: DollarSign,
    children: [
      { label: "AI Usage", path: "/ai-usage" },
      { label: "Cloud Usage", path: "/cloud-usage" },
    ],
  },
  { id: "resources", label: "Resources", icon: Server, path: "/resources" },
];

export default function MobileMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const { dark, setDark } = useTheme();
  const { closeMenu, deactivateChat } = useMobileNav();
  const [expanded, setExpanded] = useState({});

  const handleNavigate = (path) => {
    deactivateChat();
    closeMenu();
    navigate(path);
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="mobile-menu" role="dialog" aria-label="Navigation menu">
      <div className="mobile-menu__header">
        <span className="mobile-menu__title">Menu</span>
        <button
          type="button"
          className="mobile-menu__close"
          onClick={closeMenu}
          aria-label="Close menu"
        >
          <X size={20} strokeWidth={2} />
        </button>
      </div>

      <div className="mobile-menu__list">
        {menuSections.map((section) => {
          const Icon = section.icon;
          const hasChildren = section.children?.length > 0;
          const isExpanded = expanded[section.id];
          const isActive =
            !hasChildren &&
            (location.pathname === section.path ||
              location.pathname.startsWith(section.path + "/"));

          return (
            <div key={section.id} className="mobile-menu__group">
              <button
                type="button"
                className={`mobile-menu__item${isActive ? " mobile-menu__item--active" : ""}`}
                onClick={() =>
                  hasChildren ? toggleExpand(section.id) : handleNavigate(section.path)
                }
              >
                <Icon size={20} strokeWidth={1.5} />
                <span className="mobile-menu__item-label">{section.label}</span>
                {hasChildren && (
                  <ChevronDown
                    size={16}
                    strokeWidth={1.5}
                    className={`mobile-menu__chevron${isExpanded ? " mobile-menu__chevron--open" : ""}`}
                  />
                )}
              </button>

              {hasChildren && isExpanded && (
                <div className="mobile-menu__children">
                  {section.children.map((child) => {
                    const childActive =
                      location.pathname === child.path ||
                      location.pathname.startsWith(child.path + "/");
                    return (
                      <button
                        key={child.path}
                        type="button"
                        className={`mobile-menu__child${childActive ? " mobile-menu__child--active" : ""}`}
                        onClick={() => handleNavigate(child.path)}
                      >
                        {child.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mobile-menu__footer">
        <button
          type="button"
          className="mobile-menu__toggle-theme"
          onClick={() => setDark(!dark)}
        >
          {dark ? (
            <Sun size={18} strokeWidth={1.75} />
          ) : (
            <Moon size={18} strokeWidth={1.75} />
          )}
          <span>{dark ? "Light mode" : "Dark mode"}</span>
        </button>
      </div>
    </div>
  );
}
