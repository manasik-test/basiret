from fastapi import FastAPI
from app.api.v1.health import router as health_router

app = FastAPI(
    title="BASIRET API",
    description="AI-powered social media analytics platform",
    version="1.0.0",
)

app.include_router(health_router, prefix="/api/v1", tags=["system"])

@app.get("/")
def root():
    return {"message": "BASIRET API is running"}