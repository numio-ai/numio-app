import React from "react";
import { Link } from "react-router-dom";

export default function Deactivation() {
  return (
    <div className="pageContent settings-page-content">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>Deactivation</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
              Delete your account or organization. These actions are irreversible.
            </p>
          </div>
        </div>

        <div className="dangerZone">
          <div className="dangerCard">
            <h3 className="dangerCard__title">Delete Account</h3>
            <p className="dangerCard__desc">
              Deleting your account will remove you from the organization. If you are the last owner, 
              you must transfer ownership before deletion.
            </p>
            <button className="btn btn--danger">Delete Account</button>
          </div>

          <div className="dangerCard">
            <h3 className="dangerCard__title">Delete Organization</h3>
            <p className="dangerCard__desc">
              This will remove all account data, including access credentials and associated data. 
              This action is irreversible.
            </p>
            <button className="btn btn--danger">Deactivate Organization</button>
          </div>
        </div>
    </div>
  );
}
