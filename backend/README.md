# Numio Backend

Python backend for the Numio cloud cost analysis platform.

## Features

- **REST API**: FastAPI-based REST endpoints for the frontend
- **MCP Server**: FastMCP-based server for AI agent integration
- **Shared Logic**: Core business logic shared between REST and MCP

## Development

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) package manager

### Setup

```bash
cd backend

# Install dependencies
uv sync

# Run development server
uv run uvicorn numio.main:app --reload --port 8000
```

### Endpoints

- `GET /health` - Health check
- `GET /api/v1/cost/summary` - Cost summary
- `GET /api/v1/cost/by-service` - Costs by service
- `GET /api/v1/cost/trends` - Cost trends

### MCP Endpoints

- `/mcp` - Streamable HTTP transport
- `/mcp/sse` - Server-Sent Events transport

### Testing

```bash
uv run pytest
```

### Docker

```bash
# Build
docker build -t numio-srv .

# Run
docker run -p 8000:8000 numio-srv
```

## Project Structure

```
backend/
├── pyproject.toml          # Dependencies and build config
├── Dockerfile              # Container build
├── src/
│   └── numio/
│       ├── __init__.py
│       ├── main.py         # FastAPI app entrypoint
│       ├── api/            # REST API routes
│       │   └── routes.py
│       ├── mcp/            # MCP server
│       │   └── server.py
│       └── core/           # Shared business logic
│           └── services.py
└── tests/                  # Test files
```
