from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


engine = create_engine("postgresql://admin:123@localhost:5432/inventory")
Session = sessionmaker(bind=engine)
