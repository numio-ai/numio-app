import React from "react";
import { usage as _usage, plans as _plans, billingEmail as _be, paymentMethod as _pm } from "../../mocks/mockBillingPlans";
const usage = { accounts: 0, resources: 0, ..._usage };
const plans = _plans?.length ? _plans : [];
const billingEmail = _be || "";
const paymentMethod = { type: "", last4: "", ..._pm };

/* Overview-style design tokens */
import { execCardClass, execHeaderClass } from "../../constants/designTokens";

function formatCurrency(amount, forceCents = false) {
  if (forceCents || amount < 100) return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function BillingPlans() {
  const currentPlan = plans.find((p) => p.current) || plans[0] || { name: "—", price: 0 };

  return (
    <div className="pageContent settings-page-content">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 style={{ fontSize: "16px", fontWeight: 500, color: "#111827", margin: 0 }}>
              Billing & Plans
            </h1>
            <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
              Manage your plan, usage, and payment method.
            </p>
          </div>
        </div>

        {/* Plans */}
        <section
          className={execCardClass}
          style={{ marginBottom: "24px", borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
        >
          <p className={execHeaderClass}>PLANS</p>
          <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
            You're on the {currentPlan.name} plan. Upgrade for more tracked spend.{" "}
            <a href="#" className="font-medium" style={{ color: "var(--primary)" }}>Pricing</a>
            {" · "}
            <a href="#" className="font-medium" style={{ color: "var(--primary)" }}>Add coupon</a>
          </p>
          <div className="flex flex-nowrap gap-4">
            {plans.map((plan) => (
              <label
                key={plan.name}
                className={`flex-1 min-w-0 rounded-xl border p-4 cursor-pointer transition-colors ${
                  plan.current ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] hover:bg-[var(--bg-inset)]"
                }`}
              >
                <input type="radio" name="plan" defaultChecked={plan.current} className="sr-only" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold" style={{ color: "var(--text)" }}>{plan.name}</span>
                    {plan.current && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-emerald-600 bg-emerald-50">Current</span>
                    )}
                  </div>
                  <p className="text-lg font-medium" style={{ color: "var(--text)" }}>{plan.price}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>Up to {plan.limit} tracked</p>
                </div>
              </label>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Billing Email */}
          <section
            className={execCardClass}
            style={{ marginBottom: 0, borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
          >
            <p className={execHeaderClass}>BILLING EMAIL</p>
            <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
              Invoices are sent to this address.
            </p>
            <div className="flex gap-2 flex-wrap">
              <input
                type="email"
                className="formInput flex-1 min-w-[200px]"
                placeholder="billing@example.com"
                defaultValue={billingEmail}
                style={{ borderColor: "var(--border)" }}
              />
              <button className="btn btn--primary">Save</button>
            </div>
          </section>

          {/* Payment Method */}
          <section
            className={execCardClass}
            style={{ marginBottom: 0, borderColor: "var(--border)", borderRadius: "var(--radius-lg)", padding: "var(--card-padding)" }}
          >
            <p className={execHeaderClass}>PAYMENT METHOD</p>
            <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
              Pay via card or <a href="#" className="font-medium" style={{ color: "var(--primary)" }}>AWS Marketplace</a> (contact sales).
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--text-tertiary)" }}>Cardholder name</label>
                <input
                  type="text"
                  className="formInput w-full"
                  placeholder="John Smith"
                  defaultValue={paymentMethod.cardholderName}
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: "var(--text-tertiary)" }}>Card number</label>
                <input
                  type="text"
                  className="formInput w-full"
                  placeholder="4242 4242 4242 4242"
                  style={{ borderColor: "var(--border)" }}
                />
              </div>
              <button className="btn btn--primary">Save</button>
            </div>
          </section>
        </div>
    </div>
  );
}
