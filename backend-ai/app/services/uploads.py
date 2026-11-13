"""Upload validation: size limit + content sniffing (never trust client Content-Type alone)."""
from __future__ import annotations

from app.core.errors import AppError

IMAGE_MAGIC = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
}
AUDIO_TYPES = {"audio/wav", "audio/x-wav", "audio/mpeg", "audio/ogg", "audio/mp4", "audio/webm", "audio/m4a"}


def sniff_image(data: bytes) -> str | None:
    for sig, mt in IMAGE_MAGIC.items():
        if data.startswith(sig):
            return mt
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def validate_image(data: bytes, max_bytes: int) -> str:
    if not data:
        raise AppError(400, "EMPTY_UPLOAD", "Image file is empty.")
    if len(data) > max_bytes:
        raise AppError(413, "FILE_TOO_LARGE", f"Image exceeds {max_bytes // (1024 * 1024)} MB limit.")
    mt = sniff_image(data)
    if mt is None:
        raise AppError(415, "UNSUPPORTED_IMAGE_TYPE", "Image must be JPEG, PNG or WebP.")
    return mt


def validate_audio(data: bytes, content_type: str | None, max_bytes: int) -> str:
    if not data:
        raise AppError(400, "EMPTY_UPLOAD", "Audio file is empty.")
    if len(data) > max_bytes:
        raise AppError(413, "FILE_TOO_LARGE", f"Audio exceeds {max_bytes // (1024 * 1024)} MB limit.")
    ct = (content_type or "").split(";")[0].strip().lower()
    if ct not in AUDIO_TYPES:
        raise AppError(415, "UNSUPPORTED_AUDIO_TYPE", "Audio type not supported.")
    return ct
