import hmac
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

import jwt
from fastapi import Depends, Query
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings, jwt_secret
from app.errors import ApiError

Role = Literal["official", "citizen"]


@dataclass(frozen=True)
class User:
    id: str
    name: str
    role: Role

    @property
    def initials(self) -> str:
        return "".join(part[0] for part in self.name.split()[:2]).upper()

    def public(self) -> dict:
        return {"id": self.id, "name": self.name, "role": self.role, "initials": self.initials}


USERS: dict[str, User] = {
    "u-urzednik": User("u-urzednik", "Anna Nowak", "official"),
    "u-obywatel": User("u-obywatel", "Jan Kowalski", "citizen"),
}
DEFAULT_BY_ROLE: dict[str, User] = {u.role: u for u in USERS.values()}

bearer = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def secret_matches(given: str | None, expected: str) -> bool:
    return bool(expected) and given is not None and hmac.compare_digest(given.encode(), expected.encode())


def issue_token(user: User) -> tuple[str, int]:
    settings = get_settings()
    ttl = settings.jwt_ttl_min * 60
    now = datetime.now(UTC)
    payload = {
        "sub": user.id,
        "role": user.role,
        "name": user.name,
        "iss": settings.jwt_issuer,
        "iat": now,
        "exp": now + timedelta(seconds=ttl),
    }
    return jwt.encode(payload, jwt_secret(), algorithm=settings.jwt_algorithm), ttl


def decode_token(token: str) -> User:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            jwt_secret(),
            algorithms=[settings.jwt_algorithm],
            issuer=settings.jwt_issuer,
            options={"require": ["sub", "role", "exp"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise ApiError(401, "Sesja wygasła. Zaloguj się ponownie.") from exc
    except jwt.InvalidTokenError as exc:
        raise ApiError(401, "Nieprawidłowy token.") from exc
    user = USERS.get(payload["sub"])
    if user is None or user.role != payload["role"]:
        raise ApiError(401, "Nieznany użytkownik.")
    return user


def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    role: Annotated[Role | None, Query()] = None,
) -> User:
    if not get_settings().auth_enabled:
        return DEFAULT_BY_ROLE[role or "official"]
    if credentials is None:
        raise ApiError(401, "Brak tokenu. Dodaj nagłówek Authorization: Bearer <token>.")
    return decode_token(credentials.credentials)


def require_role(role: Role):
    def dependency(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]) -> User:
        if not get_settings().auth_enabled:
            return DEFAULT_BY_ROLE[role]
        if credentials is None:
            raise ApiError(401, "Brak tokenu. Dodaj nagłówek Authorization: Bearer <token>.")
        user = decode_token(credentials.credentials)
        if user.role != role:
            raise ApiError(403, "Ta operacja wymaga innej roli.")
        return user

    return dependency


def require_converter(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    api_key: Annotated[str | None, Depends(api_key_header)],
) -> User:
    if api_key is not None:
        if not secret_matches(api_key, get_settings().api_key.get_secret_value()):
            raise ApiError(401, "Nieprawidłowy klucz API.")
        return DEFAULT_BY_ROLE["official"]
    return require_role("official")(credentials)


Official = Annotated[User, Depends(require_role("official"))]
Converter = Annotated[User, Depends(require_converter)]
Citizen = Annotated[User, Depends(require_role("citizen"))]
AnyUser = Annotated[User, Depends(current_user)]
