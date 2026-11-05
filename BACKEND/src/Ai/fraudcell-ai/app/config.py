"""Uygulama ayarlari."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class DatabaseSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AI_DB_")

    host: str = "postgres"
    port: int = 5432
    name: str = "fraudcell_ai"
    user: str = "ai_app"
    password: str = "CHANGE_ME"

    @property
    def dsn(self) -> str:
        return f"postgresql+psycopg://{self.user}:{self.password}@{self.host}:{self.port}/{self.name}"


class RabbitMqSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RABBITMQ_")

    host: str = "rabbitmq"
    port: int = 5672
    user_name: str = "fraudcell"
    password: str = "CHANGE_ME"
    virtual_host: str = "/"
    exchange: str = "fraudcell.events"

    @property
    def url(self) -> str:
        return f"amqp://{self.user_name}:{self.password}@{self.host}:{self.port}/{self.virtual_host.lstrip('/')}"


class ModelSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="AI_MODEL_")

    artifact_dir: str = "models"
    risk_model_file: str = "risk_model.joblib"
    fraud_type_model_file: str = "fraud_type_model.joblib"
    bundle_version: str = "fraudcell-ai-1.0.0"


class GeminiSettings(BaseSettings):
    """Harici LLM ayarlari; SADECE aciklama anlatisi icin.

    Risk skorlama / fraud-type siniflandirma bu servisi ASLA kullanmaz. api_key
    bos veya enabled=False ise ozellik sessizce devre disi kalir ve cagiran taraf
    deterministik reason_codes'a geri duser.
    """

    model_config = SettingsConfigDict(env_prefix="GEMINI_")

    api_key: str = ""
    model: str = "gemini-flash-latest"
    timeout_seconds: float = 8.0
    enabled: bool = True

    @property
    def is_active(self) -> bool:
        return self.enabled and bool(self.api_key)


class JwtSettings(BaseSettings):
    """Identity Service's access tokens (case §3.2): RS256, keys from its JWKS."""

    model_config = SettingsConfigDict(env_prefix="AI_JWT_")

    metadata_address: str = "http://identity-service:8080/.well-known/openid-configuration"
    issuer: str = "fraudcell-identity"
    audience: str = "fraudcell-api"
    clock_skew_seconds: int = 30


class Settings(BaseSettings):
    service_name: str = "ai-service"
    database: DatabaseSettings = DatabaseSettings()
    rabbitmq: RabbitMqSettings = RabbitMqSettings()
    model: ModelSettings = ModelSettings()
    gemini: GeminiSettings = GeminiSettings()
    jwt: JwtSettings = JwtSettings()
    internal_api_token: str = "CHANGE_ME"


settings = Settings()
