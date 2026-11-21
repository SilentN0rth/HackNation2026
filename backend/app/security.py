"""JWT (HS256) + role. Sekret z JWT_SECRET albo z pliku /run/secrets/jwt_secret (Docker secrets).

AUTH_ENABLED=false (demo): bez tokenu użytkownikiem jest urzędnik z listy demo (albo obywatel na ścieżkach obywatela).
Logowanie to makieta węzła krajowego – POST /auth/token wydaje token dla użytkownika z listy.
"""

from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.config import Settings, get_settings
from app.errors import ApiError

Role = Literal["official", "citizen"]


class User(BaseModel):
    id: str
    name: str
    role: Role
    initials: str

    def as_dict(self) -> dict[str, str]:
        return {"id": self.id, "name": self.name}


DEMO_USERS: dict[str, User] = {
    "u-official": User(id="u-official", name="Anna Nowak", role="official", initials="AN"),
    "u-citizen": User(id="u-citizen", name="Jan Kowalski", role="citizen", initials="JK"),
}
DEFAULT_BY_ROLE: dict[Role, str] = {"official": "u-official", "citizen": "u-citizen"}

bearer = HTTPBearer(auto_error=False)
SettingsDep = Annotated[Settings, Depends(get_settings)]


def issue_token(user: User, settings: Settings) -> str:
    payload = {
        "sub": user.id,
        "role": user.role,
        "exp": datetime.now(UTC) + timedelta(minutes=settings.jwt_ttl_min),
    }
    return jwt.encode(payload, settings.resolved_jwt_secret, algorithm="HS256")


def current_user(
    request: Request,
    settings: SettingsDep,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User:
    if creds is not None:
        try:
            payload = jwt.decode(creds.credentials, settings.resolved_jwt_secret, algorithms=["HS256"],
                                 options={"require": ["sub", "role", "exp"]})
        except jwt.PyJWTError as e:
            raise ApiError(401, "Brak autoryzacji", "Token jest nieprawidłowy albo wygasł.") from e
        user = DEMO_USERS.get(payload["sub"])
        if user is None or user.role != payload["role"]:
            raise ApiError(401, "Brak autoryzacji", "Nieznany użytkownik.")
        return user
    if settings.auth_enabled:
        raise ApiError(401, "Brak autoryzacji", "Zaloguj się – brak nagłówka Authorization: Bearer <token>.")
    # tryb demo: rola z kontekstu żądania
    role: Role = "citizen" if _is_citizen_path(request.url.path, request.query_params.get("role")) else "official"
    return DEMO_USERS[DEFAULT_BY_ROLE[role]]


def _is_citizen_path(path: str, role_param: str | None) -> bool:
    if role_param in {"official", "citizen"}:
        return role_param == "citizen"
    return path.startswith(("/forms", "/applications", "/prefill"))


CurrentUser = Annotated[User, Depends(current_user)]


def require_role(role: Role):
    def dep(user: CurrentUser) -> User:
        if user.role != role:
            names = {"official": "urzędnika", "citizen": "obywatela"}
            raise ApiError(403, "Brak uprawnień", f"Ta operacja wymaga roli {names[role]}.")
        return user

    return dep


OfficialUser = Annotated[User, Depends(require_role("official"))]
CitizenUser = Annotated[User, Depends(require_role("citizen"))]
