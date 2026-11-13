"""Pluggable authentication/authorisation. NO fake auth ships as a default.

Teammates supply an AuthProvider that validates their real credential (JWT, session,
gateway header...) and returns a Principal. Until then every protected call is rejected.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from fastapi import Depends, Request

from app.core.errors import AppError
from app.schemas.enums import Role


@dataclass(frozen=True)
class Principal:
    user_id: str
    roles: frozenset[Role]


class AuthProvider(Protocol):
    def authenticate(self, request: Request) -> Principal | None:
        """Return a Principal for a valid credential, or None if absent/invalid."""


class UnconfiguredAuthProvider:
    def authenticate(self, request: Request) -> Principal | None:
        raise AppError(401, "AUTH_NOT_CONFIGURED",
                       "No authentication provider is configured; protected operations are disabled.")


def get_principal(request: Request) -> Principal:
    principal = request.app.state.auth_provider.authenticate(request)
    if principal is None:
        raise AppError(401, "UNAUTHENTICATED", "Valid credentials are required.")
    return principal


def require_roles(*allowed: Role):
    def dep(principal: Principal = Depends(get_principal)) -> Principal:
        if not (principal.roles & set(allowed)):
            raise AppError(403, "FORBIDDEN", "Your role may not perform this action.")
        return principal
    return dep
