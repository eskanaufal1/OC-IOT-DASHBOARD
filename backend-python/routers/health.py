from models.schemas import HealthResponse


async def get_health() -> HealthResponse:
    return HealthResponse(status="healthy", version="1.0.0")
