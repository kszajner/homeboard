"""Application settings loaded from environment variables."""
from __future__ import annotations

import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Home Dashboard"
    app_env: str = "development"
    log_level: str = "INFO"

    host: str = "0.0.0.0"
    port: int = 8089

    timezone: str = "Europe/Warsaw"

    database_url: str = "sqlite+aiosqlite:///data/dashboard.db"

    weather_lat: float = 54.4418
    weather_lon: float = 18.5601
    weather_city: str = "Sopot"

    @property
    def ical_urls(self) -> list[str]:
        urls: list[str] = []
        for key, value in os.environ.items():
            if key.startswith("ICAL_URL_") and value.strip():
                urls.append(value.strip())
        return urls


@lru_cache
def get_settings() -> Settings:
    return Settings()
