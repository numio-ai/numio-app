FROM python:3.12-slim

ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown
ARG VERSION=0.0.0-dev
ARG SOURCE_URL=https://gitlab.com/numio-ai/numio-app
ARG IMAGE_TITLE=numio-srv

LABEL org.opencontainers.image.title="${IMAGE_TITLE}" \
      org.opencontainers.image.source="${SOURCE_URL}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.vendor="Numio" \
      org.opencontainers.image.licenses="Proprietary"

WORKDIR /app

# Install uv for faster dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies only (skip installing the project itself)
RUN uv sync --frozen --no-dev --no-install-project

# Copy source code and migration files
COPY src/ ./src/
COPY alembic.ini ./
COPY alembic/ ./alembic/

# Run from the uv-managed virtualenv and import from /app/src
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app/src"

# Expose port
EXPOSE 8000

# Container health check (no curl dependency)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health').read()"

# Run the application
CMD ["uvicorn", "numio.main:app", "--host", "0.0.0.0", "--port", "8000"]
