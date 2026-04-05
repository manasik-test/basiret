from fastapi import FastAPI
from app.api.v1.health import router as health_router
from app.api.v1.instagram import router as instagram_router
from app.api.v1.analytics import router as analytics_router

app = FastAPI(
    title="BASIRET API",
    description="AI-powered social media analytics platform",
    version="1.0.0",
)

app.include_router(health_router, prefix="/api/v1", tags=["system"])
app.include_router(instagram_router, prefix="/api/v1/instagram", tags=["instagram"])
app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["analytics"])

@app.get("/")
def root():
    return {"message": "BASIRET API is running"}