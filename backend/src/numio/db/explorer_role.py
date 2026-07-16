"""DDL helpers for the read-only Postgres role used by Data Explorer.

The same statements run in two contexts:

- The Alembic migration that introduces the role.
- A pytest fixture that asserts the SELECT-only boundary against a live
  database (because tests use ``Base.metadata.create_all`` and never run
  Alembic).

Keeping the SQL in one module guarantees the production migration and the
test setup stay in lockstep — drift here would defeat the whole point of
the role.

CONNECT on the database is granted by Postgres to PUBLIC by default, so
``numio_readonly`` inherits it without an explicit GRANT. We rely on that
to avoid templating the database name into the DDL.
"""

from __future__ import annotations

READONLY_ROLE = "numio_readonly"


def upgrade_sql(password: str) -> list[str]:
    """Return the ordered SQL statements that provision the read-only role.

    Idempotent: safe to apply against a database where the role already
    exists. If it does, the password is reset to the supplied value.
    """
    safe_pwd = password.replace("'", "''")
    return [
        # Create or update the login role.
        f"""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{READONLY_ROLE}') THEN
            EXECUTE 'CREATE ROLE {READONLY_ROLE} LOGIN PASSWORD ''{safe_pwd}''';
          ELSE
            EXECUTE 'ALTER ROLE {READONLY_ROLE} WITH LOGIN PASSWORD ''{safe_pwd}''';
          END IF;
        END$$;
        """,
        f"GRANT USAGE ON SCHEMA public TO {READONLY_ROLE}",
        f"GRANT SELECT ON ALL TABLES IN SCHEMA public TO {READONLY_ROLE}",
        # Future tables created by later migrations are SELECT-able too.
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO {READONLY_ROLE}",
    ]


def downgrade_sql() -> list[str]:
    """Return the ordered SQL statements that remove the role and grants.

    DROP OWNED BY drops every privilege granted to the role across the
    database, which is broader than the explicit REVOKEs and lets DROP ROLE
    succeed regardless of the schema state at downgrade time.
    """
    return [
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM {READONLY_ROLE}",
        f"DROP OWNED BY {READONLY_ROLE}",
        f"DROP ROLE IF EXISTS {READONLY_ROLE}",
    ]
