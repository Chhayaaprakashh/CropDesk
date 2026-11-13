from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.schemas.v1 import ErrorResponse

log = logging.getLogger("cropdesk")


class AppError(Exception):
    def __init__(self, status: int, code: str, message: str, details: list[dict] | None = None):
        self.status, self.code, self.message, self.details = status, code, message, details
        super().__init__(message)


def _cid(request: Request) -> str:
    return getattr(request.state, "correlation_id", None) or "unknown"


def _resp(request: Request, status: int, code: str, message: str, details=None) -> JSONResponse:
    body = ErrorResponse(code=code, message=message, correlation_id=_cid(request), details=details)
    return JSONResponse(status_code=status, content=body.model_dump(mode="json"),
                        headers={"X-Correlation-ID": _cid(request)})


def install(app: FastAPI) -> None:
    @app.middleware("http")
    async def correlation(request: Request, call_next):
        cid = request.headers.get("X-Correlation-ID", "")
        # accept client IDs only if they look safe; otherwise mint our own
        request.state.correlation_id = cid if 8 <= len(cid) <= 64 and cid.replace("-", "").isalnum() else uuid.uuid4().hex
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = request.state.correlation_id
        return response

    @app.exception_handler(AppError)
    async def _app(request: Request, exc: AppError):
        return _resp(request, exc.status, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def _val(request: Request, exc: RequestValidationError):
        # keep only location + message; never echo submitted values back
        det = [{"loc": [str(x) for x in e["loc"]], "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
        return _resp(request, 422, "VALIDATION_ERROR", "Request failed validation.", det)

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException):
        code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(exc.status_code, "HTTP_ERROR")
        return _resp(request, exc.status_code, code, str(exc.detail))

    @app.exception_handler(Exception)
    async def _any(request: Request, exc: Exception):
        log.error("unhandled error cid=%s type=%s", _cid(request), type(exc).__name__)  # no message/trace to client
        return _resp(request, 500, "INTERNAL_ERROR", "An internal error occurred.")
