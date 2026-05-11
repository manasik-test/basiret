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
    # NOTE: Meta exposes TWO distinct app products inside the same App, and
    # each has its OWN ID and secret. They are NOT interchangeable.
    #
    # Facebook product (Settings → Basic):
    #   * META_APP_ID         — Facebook App ID. Used for Graph API admin
    #                           calls + the data-deletion callback HMAC.
    #   * META_APP_SECRET     — Facebook App Secret. Pairs with META_APP_ID.
    #                           Reserved for future FB Graph server-to-server
    #                           calls; the data-deletion HMAC currently uses
    #                           this value too. NOT used for Instagram OAuth.
    #
    # Instagram product (Use Cases → API setup with Instagram Login):
    #   * INSTAGRAM_APP_ID     — Instagram App ID. The ONLY value Instagram's
    #                            OAuth endpoints (instagram.com/oauth/authorize
    #                            and api.instagram.com/oauth/access_token)
    #                            accept as `client_id`.
    #   * INSTAGRAM_APP_SECRET — Instagram App Secret. The ONLY value those
    #                            same endpoints accept as `client_secret`.
    #
    # Symptom of mixing them up: Meta returns "Invalid platform app" (wrong
    # client_id) or the generic "redirect_uri identical to the one you used
    # in the OAuth dialog request" (wrong client_secret — Meta's error mapper
    # bundles auth-mismatch under that misleading message).
    META_APP_ID: str
    INSTAGRAM_APP_ID: str
    META_APP_SECRET: str
    INSTAGRAM_APP_SECRET: str
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