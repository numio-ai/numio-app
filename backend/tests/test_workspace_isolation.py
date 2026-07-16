"""Integration tests: workspace-scoped data isolation."""

from numio.db.repositories import UserRepository


async def test_users_are_scoped_to_their_workspace(db_session, workspace_factory, user_factory):
    """A query for workspace A must not return users that belong to workspace B."""
    workspace_a = await workspace_factory()
    workspace_b = await workspace_factory()

    await user_factory(workspace_a.id, email="alice@a.com", name="Alice")
    await user_factory(workspace_b.id, email="bob@b.com", name="Bob")

    user_repo_a = UserRepository(db_session, workspace_a.id)
    user_repo_b = UserRepository(db_session, workspace_b.id)

    users_in_a = await user_repo_a.list()
    users_in_b = await user_repo_b.list()

    assert len(users_in_a) == 1
    assert users_in_a[0].email == "alice@a.com"

    assert len(users_in_b) == 1
    assert users_in_b[0].email == "bob@b.com"


async def test_get_user_by_id_cannot_cross_workspaces(db_session, workspace_factory, user_factory):
    """get_by_id scoped to workspace A must not return a user from workspace B."""
    workspace_a = await workspace_factory()
    workspace_b = await workspace_factory()

    bob = await user_factory(workspace_b.id, email="bob@b.com", name="Bob")

    # Attempt to fetch Bob using workspace A's scoped repository.
    user_repo_a = UserRepository(db_session, workspace_a.id)
    result = await user_repo_a.get_by_id(bob.id)

    assert result is None


async def test_default_workspace_seed(db_session):
    """seed_default_workspace creates exactly one default workspace on first call."""
    from numio.db.init_db import seed_default_workspace
    from numio.db.repositories import WorkspaceRepository
    from numio.models.workspace import DEFAULT_WORKSPACE_SLUG

    await seed_default_workspace(db_session)
    await seed_default_workspace(db_session)  # second call must be a no-op

    ws_repo = WorkspaceRepository(db_session)
    workspace = await ws_repo.get_by_slug(DEFAULT_WORKSPACE_SLUG)

    assert workspace is not None
    assert workspace.slug == DEFAULT_WORKSPACE_SLUG
