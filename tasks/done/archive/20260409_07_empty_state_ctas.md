---
status: done
kind: task
---

# T7: Empty State CTAs

Date: 2026-04-09
Design: [aws-onboarding.md](../../docs/aws-onboarding.md)

## Problem

When no AWS accounts are connected, main pages (Overview, Cloud Usage, Resources, Cost Reporting) show generic empty messages like "No cost data available" with no guidance on what the user should do. A new customer lands on a blank dashboard with no path forward.

## Goals

1. Add call-to-action components to pages that depend on AWS account data.
2. Each CTA links directly to `Settings → Integrations` (`/settings?tab=integrations`).
3. CTAs shown conditionally: only when no active accounts are connected.

## Non-goals

- Onboarding wizard or multi-step setup flow
- Changes to the Integrations page itself (that's T5)
- Loading account status from a new endpoint (use existing `GET /accounts` or app-level state)

## Constraints & Assumptions

- The mechanism for checking "any active accounts exist" should be lightweight. Options: use an existing context/state if available, or call `GET /api/v1/accounts` and check `count > 0`.
- Use existing design tokens and component patterns for consistency.
- The Resources page already has a partial setup message — enhance it with a link rather than replacing it.

## Acceptance Criteria

1. **Overview**: When no active accounts exist, displays "No cost data yet. Connect your AWS account to get started →" with a link to Settings → Integrations.
2. **Cloud Usage**: Similar CTA with link.
3. **Resources**: Existing message enhanced with link to Settings → Integrations.
4. **Cost Reporting**: Similar CTA with link.
5. When at least one active account exists, CTAs are hidden and normal page content is shown.
6. Links navigate to `/settings?tab=integrations`.

## Validation Steps

1. With no accounts registered: visit Overview, Cloud Usage, Resources, Cost Reporting. Each shows a CTA linking to Integrations.
2. Register an account (or mock one). Revisit pages — CTAs are gone, normal content shown.
3. Click a CTA — navigates to Settings → Integrations tab.

## Risks & Rollback

- Low risk. Additive UI changes. Rollback: revert the component files.
- If the "check for accounts" call is expensive or slow, it could delay page render. Mitigate by using cached state or a lightweight check.
