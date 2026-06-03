from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    student_name = Column(String, unique=True, nullable=False, index=True)
    student_role = Column(String, nullable=False)
    student_tg = Column(String, nullable=False)
    student_email = Column(String, nullable=False)

    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    student_bio = Column(String, nullable=False)
    site_path = Column(String, nullable=False)
    project_role = Column(String, nullable=False, default="frontend")
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)

    owner = relationship("Student", back_populates="projects")