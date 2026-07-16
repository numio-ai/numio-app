"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://numio:numio@localhost:5432/numio"
    environment: str = "local"
    log_level: str = "INFO"
    debug: bool = False
    app_version: str = "0.1.0"

    # Authentication
    auth_enabled: bool = False
    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""
    cognito_region: str = "us-east-1"
    session_secret_key: str = "change-me-in-production"  # Signs session cookies
    session_ttl_hours: int = 24

    # CORS — comma-separated allowed origins (e.g. "https://app.numio.ai,http://localhost:3000")
    cors_allowed_origins: str = "http://localhost:3000,http://localhost:5173"

    # Publicly reachable base URL for the Numio backend. When set, the AWS
    # onboarding CFN launch URL uses the CloudFormation quick-create flow
    # with `templateURL` pointing at `${public_base_url}/api/v1/onboarding/
    # cfn-template/download`. Leave empty in local dev — the UI falls back
    # to a manual "upload downloaded file" launch path.
    public_base_url: str = ""

    # AWS onboarding feature flags
    onboarding_chat_enabled: bool = False  # Chat-driven onboarding v0 (scripted)

    # Rate limiting (requests per minute)
    rate_limit_read: int = 100
    rate_limit_write: int = 20

    # ValKey cache for Cost Explorer pass-through
    valkey_url: str = ""
    ce_cache_ttl_seconds: int = 3600
    ce_cache_enabled: bool = True

    # Data Explorer — read-only Postgres role + connection
    # Password for the numio_readonly role created by the data-explorer migration.
    # Local-dev default is fine because Postgres binds to localhost only; in any
    # shared environment this MUST be overridden via the env var.
    data_explorer_db_password: str = "numio_readonly"
    # Optional fully-qualified DSN for the read-only connection. When empty, the
    # DSN is derived from `database_url` by replacing the userinfo with
    # numio_readonly:${DATA_EXPLORER_DB_PASSWORD}.
    data_explorer_database_url: str = ""
    # Per-query statement_timeout for ad-hoc SQL run via the Data Explorer.
    data_explorer_statement_timeout_ms: int = 10000
    # Maximum rows returned per query. The endpoint reads N+1 from the cursor
    # and reports `truncated: true` when the extra row exists.
    data_explorer_max_rows: int = 1000
    # Hard upper bound on the SQL string length the endpoint accepts.
    data_explorer_max_sql_bytes: int = 51200

    # Analytics chat LLM integration
    chat_llm_backend: str = "lmgate"  # "lmgate" or "anthropic"
    chat_lmgate_url: str = ""  # LMGate API base URL
    chat_lmgate_model: str = ""  # Model identifier for LMGate
    chat_anthropic_api_key: str = ""  # Anthropic API key (when using anthropic backend)
    chat_anthropic_model: str = "claude-sonnet-4-5-20250514"
    chat_session_ttl_hours: int = 24
    chat_max_messages_per_session: int = 50

    model_config = {"env_file": ".env", "case_sensitive": False, "extra": "ignore"}


settings = Settings()
