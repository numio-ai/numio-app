import React from "react";
import { NavLink, useLocation } from "react-router-dom";

export default function Sidebar({ items, title }) {
  const location = useLocation();
  return (
    <aside className="sidebar sidebar-nav">
      {title && <div className="sidebar__title sidebar-nav-header">{title}</div>}
      <nav className="sidebar__nav">
        {items.map((item) => {
          const isActive = item.isActive ? item.isActive(location) : undefined;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              isActive={item.isActive ? () => item.isActive(location) : undefined}
              className={({ isActive: navActive }) => {
                const active = item.isActive ? isActive : navActive;
                return `sidebar__item sidebar-nav-item ${active ? "sidebar__item--active active" : ""}`;
              }}
            >
              {item.icon && <span className="sidebar__icon">{item.icon}</span>}
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

export function SidebarLayout({ sidebar, children }) {
  return (
    <div className="sidebarLayout">
      {sidebar}
      <div className="sidebarLayout__content main-content">{children}</div>
    </div>
  );
}
