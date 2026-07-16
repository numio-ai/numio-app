import React from "react";
import { Outlet } from "react-router-dom";

/**
 * Costs section layout: content only, no secondary sidebar.
 * Navigation is via the main app sidebar only.
 */
export default function CostsLayout() {
  return <Outlet />;
}
