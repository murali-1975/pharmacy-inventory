import sys
from app.database import SessionLocal
from app import models
from sqlalchemy.exc import SQLAlchemyError
db=SessionLocal()
try:
    db.query(models.Invoice).first()
except SQLAlchemyError as e:
    print('SQL ERROR:', str(e.orig))
