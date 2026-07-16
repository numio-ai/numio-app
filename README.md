# Numio

Open-source cloud cost management co-pilot for AWS and AI workloads.

> [!IMPORTANT]
> Numio is currently alpha software. It detects and recommends cost changes but
> does not autonomously execute infrastructure changes. AWS is the only cloud
> provider supported in the current release.

## Quick Start

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose V2).

**1. Clone and start**

```bash
git clone git@github.com:numio-ai/numio-app.git
cd numio-app
docker compose up -d --build
```

> Starting fresh on a machine that has run Numio before? Run `docker compose down -v --remove-orphans` first to wipe the `pgdata` volume and previous containers.

**2. Initialize the database**

```bash
docker compose exec backend alembic upgrade head

docker compose exec postgres psql -U numio -d numio -c \
  "INSERT INTO workspaces (id, name, slug) VALUES (gen_random_uuid(), 'default', 'default') ON CONFLICT (slug) DO NOTHING;"
```

**3. Open the UI**

Open [http://localhost:3000](http://localhost:3000) in your browser.

**4. Connect your AWS account**

Navigate to **Settings → Integrations** and click **Add Account**. Enter the AWS credentials for your `numio-service` IAM user, the Role ARN, and External ID. Numio validates the connection in real time — no host-level AWS configuration required. See the [User Guide](docs/user-guide.md) for the full setup walkthrough.

**5. View your cost data**

Return to the **Overview** page. Numio ingests CUR data and displays spend breakdowns, trends, and optimization recommendations.

---

To stop all services: `docker compose down`

**For development with hot reload**, see the [Developer Runbook](docs/dev-runbook.md):
```bash
./scripts/numio-dev.sh init          # first-time setup
./scripts/numio-dev.sh run backend   # auto-starts postgres + valkey
./scripts/numio-dev.sh run frontend  # in a second terminal
```

See the [Operations Runbook](docs/ops-runbook.md) for install details, configuration, restart procedures, and troubleshooting.

## Documentation

- [User Guide](docs/user-guide.md) — How to use Numio (connect AWS accounts, view cost data)
- [Operations Runbook](docs/ops-runbook.md) — Install, configure, restart, upgrade, troubleshoot
- [Developer Runbook](docs/dev-runbook.md) — Development setup with hot reload
- [Architecture](docs/architecture-design.md) — System architecture
- [Functional Specification](docs/functional-specification.md) — Product specification

## Contributing and security

- See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and test commands.
- Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).
- Pull requests should target the `dev` integration branch. `main` is the public release branch.

## License

Apache-2.0
