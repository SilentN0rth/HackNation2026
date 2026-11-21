"""Błędy jako application/problem+json (RFC 9457) z komunikatem po polsku."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

PROBLEM_JSON = "application/problem+json"


class ApiError(Exception):
    def __init__(self, status: int, title: str, detail: str, **extra: object) -> None:
        super().__init__(detail)
        self.status = status
        self.title = title
        self.detail = detail
        self.extra = extra


def problem(status: int, title: str, detail: str, instance: str | None = None, **extra: object) -> JSONResponse:
    body: dict[str, object] = {"type": "about:blank", "title": title, "status": status, "detail": detail}
    if instance:
        body["instance"] = instance
    body.update(extra)
    return JSONResponse(body, status_code=status, media_type=PROBLEM_JSON)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(request: Request, exc: ApiError) -> JSONResponse:
        return problem(exc.status, exc.title, exc.detail, str(request.url.path), **exc.extra)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        titles = {401: "Brak autoryzacji", 403: "Brak uprawnień", 404: "Nie znaleziono", 413: "Za duży plik"}
        return problem(exc.status_code, titles.get(exc.status_code, "Błąd"), str(exc.detail), str(request.url.path))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [{"loc": list(e["loc"]), "msg": e["msg"]} for e in exc.errors()]
        return problem(422, "Niepoprawne dane", "Sprawdź przesłane pola.", str(request.url.path), errors=errors)
