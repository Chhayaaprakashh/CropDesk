from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import router
from app.core import errors
from app.core.auth import AuthProvider, UnconfiguredAuthProvider
from app.core.config import Settings
from app.repositories.base import CaseRepository, InMemoryCaseRepository


def create_app(settings: Settings | None = None, repo: CaseRepository | None = None,
               auth_provider: AuthProvider | None = None) -> FastAPI:
    """Dependency-injected factory: teammates pass their own repo and auth provider."""
    settings = settings or Settings.from_env()
    app = FastAPI(title="CROPDESK Backend/AI", version="0.1.0")
    app.state.settings = settings
    app.state.repo = repo or InMemoryCaseRepository()  # dev-only default
    app.state.auth_provider = auth_provider or UnconfiguredAuthProvider()
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins),
                       allow_methods=["GET", "POST"], allow_headers=["*"])
    errors.install(app)
    app.include_router(router)
    return app


app = create_app()
