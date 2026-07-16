# User Management Specification

**Status:** draft
**Owner:** Product
**Created:** 2026-04-26
**Phase:** 1 (native backend, single role)

## Problem statement

Numio ships with a synthetic admin (`admin@localhost`) injected by bypass-mode auth, and the frontend renders a hard-coded dummy user "James C. admin". Real teams cannot sign in, cannot be added, and cannot be removed. Without real user management Numio cannot move past single-operator demos.

## Objective

Numio is deployed in two production shapes:

| Shape | Description | Primary? |
|---|---|---|
| Cloud-hosted | Numio runs on the customer's AWS account (EC2 / ECS / EKS), served over HTTPS to a small team of 5–20 users via browser | Yes |
| Solo laptop | Single operator (e.g. CEO of a tiny company managing their own cloud) | Edge case |

A third shape — laptop dev — uses bypass mode and is not subject to user management.

For both production shapes, a team of 5–20 users sharing one Numio install must be able to:

1. Bootstrap the first admin during install (cloud or laptop, identical flow).
2. Add and remove other users from the UI.
3. Sign in concurrently from their own browsers.
4. Change their own profile.

The cloud vs. laptop deployment difference is operational, not functional. The same code paths serve both.

## Scope

### In scope (this phase)

- Native identity backend (email + password, stored in Postgres)
- First-run "create first admin" web flow
- User CRUD UI in `Settings → Users`
- Single role: `admin`. Schema and UI carry a role field, value-locked to `admin` today
- Self-service profile page (name, password, read-only workspace ID)
- Server-side sessions with sliding 24h TTL
- One-time setup links for password setup and reset (admin generates, copy-paste, no email)
- Bypass-mode rename and environment gate

### Out of scope (deferred to `user_management_extensions` feature)

- Cognito identity backend wiring (code preserved, dormant)
- Roles other than `admin` (`member`, `engineer`, `finance`, `viewer`)
- Audit log of authentication and admin actions
- Machine users / API tokens
- Mid-session forced sign-out on disable (current sessions survive until expiry)
- SMTP / email-based invitations or password resets
- Self-serve "forgot password"
- Account lockout / brute-force protection

## Personas

| Persona | Day-one capability |
|---|---|
| Admin | Add, edit, disable, re-enable users; assign roles; regenerate setup links; see user list |
| User (any logged-in actor) | Sign in, sign out, change own name and password, view workspace ID |

Day one every user has `role = admin`. The User persona is what every logged-in actor can do regardless of role.

## Architecture

### Identity backend abstraction

A single interface `IdentityBackend` with two implementations: `native` (in scope) and `cognito` (preserved, dormant). The active backend is selected by `IDENTITY_BACKEND=native|cognito` at install. Switching backends is a re-install.

Interface methods (illustrative, not prescriptive):

- `authenticate(email, password) -> User | None`
- `create_user(email, name, role) -> User`
- `update_user(id, **changes) -> User`
- `disable_user(id)` / `enable_user(id)`
- `set_password(user_id, new_password)`
- `list_users(workspace_id) -> [User]`

Setup-token issuance and consumption are native-only and live outside the abstraction (Cognito has its own confirmation flow).

### Data model

Three tables. One extends an existing `users` table; two are new.

| Table | Purpose | Key columns |
|---|---|---|
| `users` | Identity record | `id` UUID, `email` citext unique, `name`, `role` enum (`admin`), `is_active` bool, `password_hash` text nullable, `workspace_id` UUID FK, `created_at`, `updated_at` |
| `setup_tokens` | One-time setup / reset links | `id` UUID, `user_id` FK, `token_hash` (sha256 of raw token; raw never stored), `expires_at`, `used_at` nullable, `created_by_user_id` FK |
| `sessions` | Server-side session store | `id` UUID, `user_id` FK, `token_hash`, `expires_at`, `last_seen_at`, `created_at`, `revoked_at` nullable |

`password_hash` uses Argon2id with library defaults. Plaintext passwords are never logged.

`email` is normalized to lowercase on write. The `citext` extension or an explicit `lower(email)` unique index satisfies case-insensitive uniqueness.

### Authentication flow

1. Client `POST /api/v1/auth/login` with email and password.
2. Backend calls `NativeIdentityBackend.authenticate`.
3. On success, backend creates a `sessions` row, sets a httponly secure cookie carrying the raw session token. Returns the user.
4. On every subsequent request, middleware looks up the session by hashed token, checks `expires_at > now() AND revoked_at IS NULL AND user.is_active`, updates `last_seen_at`, and slides `expires_at` to `now() + 24h`.
5. `POST /api/v1/auth/logout` sets `revoked_at`.

### Setup-link flow

1. Admin calls `POST /api/v1/users` (new user) or `POST /api/v1/users/{id}/setup-link` (regenerate). Backend generates a random raw token, stores `token_hash`, returns the raw URL once.
2. Admin shares the URL with the user via any channel.
3. User opens the URL. Frontend calls `GET /api/v1/auth/setup/{token}` to validate. If valid (not expired, not used), renders the set-password form.
4. User submits new password. Backend calls `POST /api/v1/auth/setup` with the token and the password. Backend marks token used, sets `password_hash`, creates a session, signs the user in.
5. Issuing a new link for a user invalidates any prior unused link and any existing password.

### Bypass-mode coexistence

`AUTH_BYPASS=true` short-circuits the auth middleware. The synthetic admin (`admin@localhost`) is returned for every request. No `users`, `setup_tokens`, or `sessions` rows are read or written. `Settings → Users` is hidden in the UI. `/api/v1/setup/state` always reports `needs_first_admin: false`.

The backend refuses to start if `AUTH_BYPASS=true && ENVIRONMENT != local`, logs a clear error, and exits non-zero. Default for shipped images is `AUTH_BYPASS=false`.

`AUTH_ENABLED` is the previous name. One release supports both names with a deprecation warning, then the old name is removed.

## API endpoints

| Group | Method + Path | Auth | Purpose |
|---|---|---|---|
| Setup | `GET /api/v1/setup/state` | Public | `{ needs_first_admin: bool }` |
| Setup | `POST /api/v1/setup/first-admin` | Public, gated by state | Create first admin (email, name, password) |
| Auth | `POST /api/v1/auth/login` | Public | Sign in |
| Auth | `POST /api/v1/auth/logout` | Authenticated | Sign out |
| Auth | `GET /api/v1/auth/me` | Authenticated | Current user |
| Setup link | `GET /api/v1/auth/setup/{token}` | Public, token-gated | Verify token validity |
| Setup link | `POST /api/v1/auth/setup` | Public, token-gated | Consume token, set password, sign in |
| Users | `GET /api/v1/users` | Admin | List users |
| Users | `POST /api/v1/users` | Admin | Create user, returns one-time setup URL |
| Users | `PATCH /api/v1/users/{id}` | Admin | Update name, email, role |
| Users | `POST /api/v1/users/{id}/disable` | Admin | Disable (last-admin guard) |
| Users | `POST /api/v1/users/{id}/enable` | Admin | Re-enable |
| Users | `POST /api/v1/users/{id}/setup-link` | Admin | Regenerate setup link (invalidates prior link and password) |
| Profile | `PATCH /api/v1/me` | Authenticated | Change own name |
| Profile | `POST /api/v1/me/password` | Authenticated | Change own password (requires current password) |
| Workspace | `GET /api/v1/me/workspace` | Authenticated | `{ id }` for read-only display |

## Frontend routes

| Route | Purpose | Visible to |
|---|---|---|
| `/setup` | First-run create-first-admin form | Public, only when `needs_first_admin=true` |
| `/login` | Sign-in form | Public |
| `/setup/:token` | Set password using one-time link | Public, token-gated |
| `/settings/users` | List, add, edit, disable, regenerate-link | Admin only |
| `/me` | Profile (name, password, workspace ID read-only) | Authenticated |

Bottom-left user menu (matches current Numio UX, aligned with Anthropic / ChatGPT pattern): user name + avatar → "My profile" / "Sign out". Replaces every "James C. admin" reference.

## Requirements

### Identity & data model

**R1 — Pluggable identity backend.** The backend supports two identity backends behind a single interface: `native` and `cognito`. The active backend is selected by a single env var at install. Switching backends is a re-install. Cognito implementation is not built in this phase but the interface and existing Cognito code are preserved.

**R2 — User record.** Every user has: `id` (UUID), `email` (citext, unique, immutable), `name`, `role` (enum, day-one value `admin`), `is_active` (bool), `password_hash` (native backend only, nullable until setup completes), `created_at`, `updated_at`, `workspace_id` (FK).

**R3 — Email is the login identifier.** Case-insensitive, normalized to lowercase on write, immutable after creation. Reusing an email requires disabling the existing row first.

### Bootstrap

**R4 — First-run setup flow.** On a fresh install (native backend, zero users in DB), the backend exposes a `setup` state. The frontend detects this state and shows a one-screen "Create first admin" form (email, name, password). All other routes redirect to setup until completed. Once the first admin exists, setup endpoints are disabled until the user table is empty again.

### User management

**R5 — Add user.** Admin enters email, name, role. System generates a one-time setup token (URL with embedded token, valid 7 days, single-use). UI displays the URL once for the admin to share manually. No email is sent.

**R6 — Set password via setup link.** Recipient opens the URL, sets password (≥ 8 characters, no composition rules), is signed in.

**R7 — Disable / re-enable user.** Admin toggles `is_active`. No hard-delete in UI. Disabled users cannot sign in and cannot create new sessions. Disabled users can be re-enabled.

**R8 — Last-admin guard.** The system rejects any operation that would leave zero active users with `role = admin`. UI disables the action with a tooltip; backend rejects with HTTP 409.

**R9 — Admin can edit any user's email, name, role.** Email change creates a new row and disables the old (per R3). Name and role edit in place.

**R10 — Self-service profile.** Logged-in user can change own `name` and `password`. Cannot change own `email` or `role`. Reachable from the bottom-left user menu.

**R11 — Admin regenerate setup link.** At any time admin can regenerate a one-time setup link for any user — first-time setup, lost link, or password reset. Issuing a new link invalidates the previous link and any existing password. UI label: "Generate setup link" if no password set, "Reset password" if one is.

### Sessions & auth

**R12 — Sign-in.** Email + password. On success the backend creates a server-side session and returns an httponly secure cookie. Session TTL is 24 hours, sliding (refreshes on each authenticated request).

**R13 — Sign-out.** Explicit sign-out invalidates the session server-side.

**R14 — Disabled mid-session.** Existing sessions survive until natural expiry (TTL or sign-out). Backend rejects new sign-in attempts. Immediate invalidation is deferred.

**R15 — Password storage.** `password_hash` uses Argon2id with library defaults. Plaintext passwords are never logged.

### Bypass mode

**R16 — Rename.** `AUTH_ENABLED=false` is renamed to `AUTH_BYPASS=true`. Default is `false` (real auth on). One release of dual-read for compatibility, then the old name is removed.

**R17 — Environment gate.** Backend refuses to start if `AUTH_BYPASS=true` and `ENVIRONMENT != local`. Logs a clear error and exits non-zero.

**R18 — Bypass behavior unchanged.** When bypass is active, every request runs as the synthetic `admin@localhost`. The Settings → Users page is hidden. No real user rows are created or read.

### Workspace visibility

**R19 — Workspace ID visibility.** The active workspace UUID is displayed read-only on the profile page and on `Settings → Integrations`, for copy-paste use during AWS onboarding. No selector, no editor.

## Acceptance criteria

**A1.** Fresh install with `AUTH_BYPASS=false` (native backend) lands the user on a "Create first admin" screen on first visit. After completing, the user is signed in as that admin.

**A2.** Signed-in admin sees `Settings → Users` listing themselves. Can add a second user; UI shows a one-time setup URL. Pasting the URL in a private window lets the new user set a password and lands them signed in.

**A3.** Admin disables a user. That user, if currently signed in, continues until session expiry but cannot sign in again. Re-enabling restores sign-in.

**A4.** With one active admin, the Disable action and any role change on that admin are greyed out and tool-tipped. Direct API calls return HTTP 409.

**A5.** Any logged-in user can open a profile page and change their own name and password. The page does not expose email or role edit. The page displays the active workspace UUID read-only.

**A6.** `AUTH_BYPASS=true` with `ENVIRONMENT=production` prevents startup with a clear error in the log.

**A7.** `AUTH_BYPASS=true` with `ENVIRONMENT=local` works exactly as today: synthetic admin, no Settings → Users page, no DB user rows touched.

**A8.** The `cognito` identity backend code in the repository compiles and tests pass. The backend is dormant but not deleted.

## Glossary

- **Admin** — a user with `role = admin`. Day one every user is an admin.
- **Bypass mode** — `AUTH_BYPASS=true`, dev-only, gated to `ENVIRONMENT=local`. Returns a synthetic admin for every request.
- **Setup link** — a one-time URL issued by an admin that lets a recipient set their own password.
- **Workspace** — a tenancy boundary. Single install = single workspace today. Surfaced read-only.

## Future work

Tracked under feature `user_management_extensions`. See `tasks/features/<date>_user_management_extensions.md`.
