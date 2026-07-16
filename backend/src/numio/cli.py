"""CLI management commands for Numio.

Usage:
    python -m numio.cli create-api-key --name "My Key"
"""

import argparse
import asyncio
import sys

from sqlalchemy import select

from numio.core.auth import API_KEY_PREFIX, generate_api_key
from numio.db.session import AsyncSessionLocal
from numio.models.api_key import ApiKey
from numio.models.user import User
from numio.models.workspace import Workspace


async def _create_seed_api_key(name: str) -> None:
    """Create an API key for the first admin user in the default workspace."""
    async with AsyncSessionLocal() as session:
        # Find default workspace
        result = await session.execute(select(Workspace).where(Workspace.slug == "default"))
        workspace = result.scalar_one_or_none()
        if workspace is None:
            print("Error: Default workspace not found. Run seed data first.")
            sys.exit(1)

        # Find or create an admin user
        user_result = await session.execute(
            select(User).where(User.workspace_id == workspace.id, User.role == "admin")
        )
        user = user_result.scalar_one_or_none()
        if user is None:
            user = User(
                workspace_id=workspace.id,
                email="admin@localhost",
                name="Seed Admin",
                role="admin",
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            print(f"Created seed admin user: {user.email}")

        raw_key, key_hash = generate_api_key()
        api_key = ApiKey(
            workspace_id=str(workspace.id),
            user_id=user.id,
            name=name,
            key_hash=key_hash,
            key_prefix=raw_key[: len(API_KEY_PREFIX) + 8],
        )
        session.add(api_key)
        await session.commit()

        print(f"API key created: {raw_key}")
        print("Store this key securely — it cannot be retrieved again.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Numio CLI")
    sub = parser.add_subparsers(dest="command")

    key_parser = sub.add_parser("create-api-key", help="Create a seed API key")
    key_parser.add_argument("--name", default="seed-key", help="Key name")

    args = parser.parse_args()

    if args.command == "create-api-key":
        asyncio.run(_create_seed_api_key(args.name))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
