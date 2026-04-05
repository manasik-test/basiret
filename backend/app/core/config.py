from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    SECRET_KEY: str
    ENVIRONMENT: str = "development"

    META_APP_ID: str
    META_APP_SECRET: str
    INSTAGRAM_REDIRECT_URI: str = "http://localhost:8000/api/v1/instagram/callback"
    INSTAGRAM_TEST_TOKEN: str = ""

    class Config:
        env_file = ".env"

settings = Settings()