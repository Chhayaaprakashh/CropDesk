"""Centralised configuration. Reads env vars only; never logs or returns secrets."""
from __future__ import annotations

import os
from dataclasses import dataclass, field


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    nexus_base_url: str = ""
    nexus_api_key: str = field(default="", repr=False)  # repr=False: keep out of logs
    nexus_vision_model: str = ""
    nexus_stt_model: str = ""
    nexus_llm_model: str = ""
    nexus_llm_model_b: str = ""
    nexus_tts_model: str = ""
    nexus_timeout_s: int = 30
    cors_origins: tuple[str, ...] = ("http://localhost:3000",)
    audio_storage_dir: str = "./var/audio"
    max_image_bytes: int = 8 * 1024 * 1024
    max_audio_bytes: int = 10 * 1024 * 1024
    auth_mode: str = "unconfigured"

    @classmethod
    def from_env(cls) -> "Settings":
        e = os.environ.get
        origins = tuple(o.strip() for o in e("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip())
        return cls(
            nexus_base_url=e("NEXUS_BASE_URL", ""), nexus_api_key=e("NEXUS_API_KEY", ""),
            nexus_vision_model=e("NEXUS_VISION_MODEL", ""), nexus_stt_model=e("NEXUS_STT_MODEL", ""),
            nexus_llm_model=e("NEXUS_LLM_MODEL", ""), nexus_llm_model_b=e("NEXUS_LLM_MODEL_B", ""),
            nexus_tts_model=e("NEXUS_TTS_MODEL", ""), nexus_timeout_s=_int("NEXUS_TIMEOUT_S", 30),
            cors_origins=origins, audio_storage_dir=e("AUDIO_STORAGE_DIR", "./var/audio"),
            max_image_bytes=_int("MAX_IMAGE_MB", 8) * 1024 * 1024,
            max_audio_bytes=_int("MAX_AUDIO_MB", 10) * 1024 * 1024,
            auth_mode=e("AUTH_MODE", "unconfigured"),
        )

    def _base(self) -> bool:
        return bool(self.nexus_base_url and self.nexus_api_key)

    def configured(self) -> dict[str, bool]:
        """Configuration present != verified working. Live verification is a Phase 3 task."""
        return {
            "vision": self._base() and bool(self.nexus_vision_model),
            "speech_to_text": self._base() and bool(self.nexus_stt_model),
            "llm": self._base() and bool(self.nexus_llm_model),
            "text_to_speech": self._base() and bool(self.nexus_tts_model),
        }
