---
name: deploy-demo
description: Build the Numio frontend in mock mode and publish it as the public standalone demo at demo.numio.ai. Use when the user asks to deploy, refresh, publish, or "ship" the demo, or to update demo.numio.ai. Wraps scripts/deploy-demo.sh (mock build -> S3 -> CloudFront invalidation -> verify).
---

# Deploy the public demo (demo.numio.ai)

The public demo at **https://demo.numio.ai** is the real Numio frontend built in
mock mode (`VITE_API_MODE=mock`): synthetic data, no backend, no separate fork.
This skill publishes a fresh build of it. Everything is wrapped by
`scripts/deploy-demo.sh`.

## When this skill applies
- "deploy / refresh / publish the demo", "update demo.numio.ai", "ship the demo".

## This is a production deploy
It syncs to a public S3 bucket and invalidates a live CloudFront distribution.
**Confirm intent with the user before running** (unless they already said to go
ahead this turn). Never pass `-y` on the user's behalf without that go-ahead.

## Steps

1. **Preflight** — confirm AWS credentials for the `agenture-prod` profile:
   ```bash
   aws sts get-caller-identity --profile agenture-prod
   ```
   If it fails, the operator must SSO-login from the infra repo
   (`./scripts/aws-admin.sh sso login`) — you cannot do it for them. Surface this
   and stop.

2. **Dry run** to show exactly what will happen:
   ```bash
   ./scripts/deploy-demo.sh --dry-run
   ```

3. **Deploy** once the user confirms:
   ```bash
   ./scripts/deploy-demo.sh          # prompts before publishing
   # or, when the user has already approved this turn:
   ./scripts/deploy-demo.sh -y
   ```
   The script builds the mock bundle, **refuses to deploy a non-mock (real) build**
   (safety gate), syncs `frontend/dist/` to S3 with `--delete`, invalidates
   CloudFront, and curls `demo.numio.ai`.

4. **Report** the final HTTP status the script prints. A non-200 right after
   deploy usually means CloudFront is still invalidating (a few minutes) — not a
   failure; tell the user to re-check shortly.

## Options worth knowing
- `--build-only` — produce the mock bundle without deploying (local check).
- `--no-invalidate` — skip the CloudFront invalidation.
- `--bucket=… / --dist-id=…`, or env `S3_BUCKET / CLOUDFRONT_DIST_ID / AWS_REGION /
  AWS_PROFILE / DEMO_URL` — target a different environment.

## Notes
- Defaults (bucket `www-agenture-sites--demo-numio-ai`, CloudFront `EKTOKO09ZQQ04`,
  region `us-west-1`, profile `agenture-prod`) match the
  `prod-website-demo-numio-ai` infra stack and `docs/dev-runbook.md`.
- The sibling `numio-demo` repo is the legacy fork this supersedes; do not deploy
  both to the same target.
