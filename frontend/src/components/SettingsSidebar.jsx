import React from "react";
import Sidebar from "./Sidebar";
import { settingsGeneralSidebarItems, settingsPersonalSidebarItems } from "../config/settingsSidebarItems";

/** Unified Settings sidebar — same items on /settings/* and /account/profile/* */
export default function SettingsSidebar() {
  return (
    <div className="settingsSidebar">
      <div className="settingsSidebar__section">
        <div className="settingsSidebar__title">General Settings</div>
        <Sidebar items={settingsGeneralSidebarItems} />
      </div>
      <div className="settingsSidebar__section">
        <div className="settingsSidebar__title">Personal Settings</div>
        <Sidebar items={settingsPersonalSidebarItems} />
      </div>
    </div>
  );
}
