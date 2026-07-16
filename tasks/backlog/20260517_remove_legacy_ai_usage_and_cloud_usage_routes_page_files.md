---
status: backlog
kind: task
feature: ia_v2_release_cleanup
title: Remove legacy /ai-usage and /cloud-usage routes + page files
---

# Remove legacy /ai-usage and /cloud-usage routes + page files

## Problem statement

`/ai-usage` and `/cloud-usage` continue to route to `AIUsagePage.jsx` / `CloudUsagePage.jsx`. The IA v2 sidebar's Usage entry points at `/usage`, not these paths. The legacy pages were kept alive during the IA v2 rollout so feature B could land cleanly; they have no v2 entry point and the embedded sub-pages they referenced (`<AIWorkloads>`, `<Recommendations>`) were already replaced with `<PendingRedesignPanel>` placeholders.

## Scope

In scope:
- Delete the two `<Route>` lines in `App.jsx` for `/ai-usage` and `/cloud-usage`.
- Delete the two `React.lazy(() => import(...))` lines for `AIUsagePage` and `CloudUsagePage`.
- Delete `frontend/src/pages/AIUsage/AIUsagePage.jsx` and the `AIUsage/` directory.
- Delete `frontend/src/pages/CloudUsage/CloudUsagePage.jsx` and the `CloudUsage/` directory.
- Sweep any remaining in-app references (in-app `<Link to="/ai-usage">`, mobile menu/tab bar entries, chat-panel context prompts, etc.).

Out of scope:
- The new `/usage` page is already shipped by feature `ia_v2_understand` and is not touched here.

## Acceptance criteria

A1. `git grep -F '"/ai-usage"' frontend/src/` and `git grep -F '"/cloud-usage"' frontend/src/` both return zero matches.

A2. `git grep -F 'AIUsagePage' frontend/src/` and `git grep -F 'CloudUsagePage' frontend/src/` both return zero matches.

A3. Visiting `/ai-usage` and `/cloud-usage` in the dev frontend renders the inline `<NotFound>` 404 page (H1 "404 — Page not found").

A4. `cd frontend && npm test && npm run build` pass with no new failures.

## Quality gates

- All four grep checks above return zero.
- Frontend tests + build pass.
- Manual: open `/ai-usage` and `/cloud-usage` in the dev frontend — both render the 404 page.
