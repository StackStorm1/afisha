from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy import select
from app.db.session import AsyncSession, get_async_db

app = FastAPI()

@app.get("/health")
async def health(db: AsyncSession = Depends(get_async_db)):
    try:
        res = (await db.scalars(select(1))).first()
        return {'status': 'ok'}
    except Exception:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail='Сервис недоступен')
        