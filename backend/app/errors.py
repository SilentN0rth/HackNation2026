from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

PROBLEM = "application/problem+json"

TITLES = {
    400: "Nieprawidłowe żądanie",
    401: "Wymagane logowanie",
    403: "Brak uprawnień",
    404: "Nie znaleziono",
    409: "Konflikt",
    413: "Plik jest za duży",
    415: "Nieobsługiwany typ pliku",
    422: "Nieprawidłowe dane",
    500: "Błąd serwera",
    503: "Usługa niedostępna",
}


class ApiError(Exception):
    def __init__(self, status: int, detail: str, title: str | None = None, **extra: object):
        super().__init__(detail)
        self.status = status
        self.detail = detail
        self.title = title or TITLES.get(status, "Błąd")
        self.extra = extra


def problem(status: int, detail: str, title: str | None = None, instance: str | None = None, **extra: object) -> JSONResponse:
    body = {"type": "about:blank", "title": title or TITLES.get(status, "Błąd"), "status": status, "detail": detail}
    if instance:
        body["instance"] = instance
    body.update(extra)
    return JSONResponse(body, status_code=status, media_type=PROBLEM)


def install(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error(request: Request, exc: ApiError) -> JSONResponse:
        return problem(exc.status, exc.detail, exc.title, request.url.path, **exc.extra)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else TITLES.get(exc.status_code, "Błąd")
        if exc.status_code == 404 and detail == "Not Found":
            detail = "Nie ma takiego zasobu."
        if exc.status_code == 405:
            detail = "Ta metoda nie jest obsługiwana dla tego adresu."
        return problem(exc.status_code, detail, instance=request.url.path)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {"pole": ".".join(str(p) for p in e.get("loc", ())), "komunikat": e.get("msg", "")}
            for e in exc.errors()
        ]
        return problem(422, "Żądanie zawiera nieprawidłowe dane.", instance=request.url.path, errors=errors)
