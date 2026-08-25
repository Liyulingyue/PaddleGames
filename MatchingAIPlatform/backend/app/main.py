from fastapi import FastAPI

app = FastAPI(title="Matching AI Platform", description="AI匹配平台后端API", version="1.0.0")

@app.get("/")
async def root():
    return {"message": "Welcome to Matching AI Platform"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}