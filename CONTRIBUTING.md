# Contributing to Numio

Thank you for helping improve Numio.

## Development workflow

1. Create a topic branch from `dev`.
2. Keep changes focused and include tests for changed behavior.
3. Run the backend and frontend checks described below.
4. Open a pull request targeting `dev`.

`dev` is the integration branch. Tested changes are promoted from `dev` to
`main`, which is the public release branch.

Do not include credentials, account identifiers, customer data, private URLs,
or other sensitive information in source code, examples, fixtures, commits, or
pull-request descriptions. Follow [SECURITY.md](SECURITY.md) for vulnerability
reports.

## Verification

Backend:

```bash
cd backend
VIRTUAL_ENV=.venv uv run --active pytest -q
```

Frontend:

```bash
cd frontend
npm test
npm run build
```

See [docs/dev-runbook.md](docs/dev-runbook.md) for initial setup and local
development commands.

## Releasing container images

Numio ships two public container images from GitLab CI:

- `registry.gitlab.com/numio-ai/numio-app/numio-srv` — backend (FastAPI + MCP) and worker.
- `registry.gitlab.com/numio-ai/numio-app/numio-ui` — frontend (static bundle served by nginx).

Both images are public. A host with no GitLab authentication can pull them.

### What triggers a build

| Git event | Tags pushed |
|---|---|
| Push to default branch (`dev`) | `:latest`, `:<short-sha>` |
| Push of an annotated tag matching `vX.Y.Z` | `:X.Y.Z`, `:<short-sha>` |
| Merge request | leak-guard only; nothing is pushed |

`:<short-sha>` is the 8-character commit SHA GitLab CI provides as `CI_COMMIT_SHORT_SHA`.

### Cutting a release

1. Merge everything into the default branch.
2. From `main`, create an annotated tag matching `vX.Y.Z` and push it to the
   GitLab mirror, where the container publishing pipeline runs:
   ```
   git tag -a v0.1.0 -m "Numio 0.1.0"
   git push gitlab v0.1.0
   ```
3. Watch the pipeline under **CI/CD → Pipelines**. Two jobs (`build:numio-srv`, `build:numio-ui`) publish to the container registry.
4. Verify from a host with no GitLab login:
   ```
   docker pull registry.gitlab.com/numio-ai/numio-app/numio-srv:0.1.0
   docker pull registry.gitlab.com/numio-ai/numio-app/numio-ui:0.1.0
   ```

### `:latest` policy

`:latest` moves **on every push to the default branch**. It is a convenience tag for laptop / demo use; it is not suitable for production pinning. Operators pin to a specific `vX.Y.Z` semver tag in `NUMIO_VERSION`.

### Tag-scheme rules

- Only tags matching the regex `^v\d+\.\d+\.\d+$` produce semver-tagged images. Pre-release tags (`v0.1.0-rc1`, `v0.1.0-beta`) are ignored by the pipeline; if that is needed, widen the rule in `.gitlab-ci.yml`.
- `:<short-sha>` is always pushed alongside the primary tag so every published image is traceable to a commit even if `:latest` is later overwritten.
- `:latest` is **not** pushed from a release tag. A fresh merge to `dev` after the tag is required to re-advance `:latest`.

### What you do not need to configure

- No CI variables to set. Pushes use the built-in `$CI_REGISTRY_USER` / `$CI_REGISTRY_PASSWORD` tokens.
- No registry mirroring. Images are published to GitLab only.

### Secret hygiene

The pipeline's `leak-guard` stage fails the build if any `.env` or `.env.*` file is present in the repository (excluding `.env.example`). This is a safety net; the primary guard is `backend/.dockerignore` and `frontend/.dockerignore`.

Do not commit real `.env` files. Do not pass secrets via `--build-arg` — build args are recorded in the image layers and `docker inspect` will show them.
