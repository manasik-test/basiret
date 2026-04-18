from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.instagram import router as instagram_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.billing import router as billing_router
from app.api.v1.admin import router as admin_router
from app.api.v1.reports import router as reports_router

app = FastAPI(
    title="BASIRET API",
    description="AI-powered social media analytics platform",
    version="1.0.0",
)

# CORS — allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api/v1", tags=["system"])
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(instagram_router, prefix="/api/v1/instagram", tags=["instagram"])
app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(billing_router, prefix="/api/v1/billing", tags=["billing"])
app.include_router(admin_router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(reports_router, prefix="/api/v1/reports", tags=["reports"])


@app.get("/")
def root():
    return {"message": "BASIRET API is running"}
