from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    SECRET_KEY: str
    ENVIRONMENT: str = "development"

    # JWT
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    JWT_ALGORITHM: str = "HS256"

    # Instagram OAuth
    # NOTE: Meta exposes TWO distinct app IDs:
    #   * META_APP_ID         — the Facebook App ID. Used for Graph API
    #                           server-to-server admin calls (data-deletion
    #                           callback HMAC, app-level diagnostics).
    #   * INSTAGRAM_APP_ID    — the Instagram product's App ID, shown on the
    #                           Instagram product page inside the same Meta
    #                           App. This is the ONLY value Instagram's OAuth
    #                           endpoint (instagram.com/oauth/authorize +
    #                           api.instagram.com/oauth/access_token) accepts
    #                           as `client_id`. Passing the Facebook App ID
    #                           there returns "Invalid platform app".
    # META_APP_SECRET is the Instagram product's App Secret (Meta confusingly
    # surfaces it under the same name) — used for the token exchange and the
    # data-deletion HMAC. Kept under the existing name to avoid a churny
    # rename of a working call site.
    META_APP_ID: str
    INSTAGRAM_APP_ID: str
    META_APP_SECRET: str
    INSTAGRAM_REDIRECT_URI: str = "http://localhost:8000/api/v1/instagram/callback"
    INSTAGRAM_TEST_TOKEN: str = ""

    # Gemini AI
    GEMINI_API_KEY: str = ""

    # OpenAI (used for caption generation — separate quota from Gemini)
    OPENAI_API_KEY: str = ""
    OPENAI_CAPTION_MODEL: str = "gpt-4o-mini"

    # AI routing flags
    # Comment topic extraction via Gemini — OFF by default because it fires
    # one API call per comment and quickly exhausts the free-tier quota.
    EXTRACT_COMMENT_TOPICS: bool = False
    # Post topic extraction: "gemini" (remote), "local" (KeyBERT/yake), or "off".
    POST_TOPIC_EXTRACTOR: str = "gemini"

    # AI per-account rate limits (rolling 24-hour window). Background SWR
    # refreshes bypass the limit but are still logged. Set to 0 to disable.
    AI_GEMINI_DAILY_LIMIT_PER_ACCOUNT: int = 50
    AI_OPENAI_DAILY_LIMIT_PER_ACCOUNT: int = 100
    # Ask-Basiret chat: per-account 24h ceiling, counted against ai_usage_log
    # rows with task="ask". Tighter than the provider-level Gemini cap because
    # users can fire many small follow-up questions in quick succession.
    AI_ASK_DAILY_LIMIT_PER_ACCOUNT: int = 20

    # RapidAPI — used by the competitor and trends services to fetch real
    # public-profile and hashtag-trend data. When unset, those endpoints fall
    # back to the bundled mock dataset.
    RAPIDAPI_KEY: str = ""
    RAPIDAPI_INSTAGRAM_HOST: str = "instagram-scraper-api2.p.rapidapi.com"

    # Cloudflare R2 — S3-compatible object storage for Post Creator media.
    # When R2_ACCOUNT_ID is empty the storage helper falls back to writing
    # files under /tmp/basiret-media/ and serving them via /api/v1/media/.
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = "basiret-media"
    R2_PUBLIC_URL: str = ""

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_STARTER_PRICE_ID: str = ""
    STRIPE_INSIGHTS_PRICE_ID: str = ""
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()