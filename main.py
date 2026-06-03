import os
import zipfile
from fastapi import FastAPI, Request, Depends, Form, UploadFile, File, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from transliterate import slugify
import shutil
from typing import Optional

import models
from database import engine, get_db
from models import Student, Project

MAX_FILE_SIZE = 15 * 1024 * 1024
MAX_UNZIP_SIZE = 50 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    '.html', '.htm', '.css', '.js', '.json',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
    '.woff', '.woff2', '.ttf', '.eot',
    '.mp4', '.webm', '.ogg', '.mp3',
}

app = FastAPI(title="DEV•HUB API")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

models.Base.metadata.drop_all(bind=engine)
models.Base.metadata.create_all(bind=engine)









@app.get("/", response_class=HTMLResponse)
async def read_index(request: Request, db: Session = Depends(get_db)):
    latest_projects = db.query(Project).order_by(Project.id.desc()).limit(3).all()
    
    total_students = db.query(Student).count()
    total_projects = db.query(Project).count()

    return templates.TemplateResponse(
        request=request, 
        name="index.html", 
        context={
            "projects": latest_projects,
            "total_students": total_students,
            "total_projects": total_projects
        }
    )




@app.get("/portfolios", response_class=HTMLResponse)
async def read_portfolios(request: Request, db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    return templates.TemplateResponse(
        request=request, 
        name="portfolios.html", 
        context={"projects": projects}
    )






@app.get("/upload", response_class=HTMLResponse)
async def read_upload(request: Request):
    return templates.TemplateResponse(request=request, name="upload.html", context={})



@app.post("/upload-portfolio")
async def upload_portfolio(
    student_name: str = Form(...),
    project_role: str = Form(...),  
    telegram: str = Form(...),      
    email: str = Form(...),         
    site_name: str = Form(...),          
    student_bio: str = Form(...),
    zip_file: UploadFile = File(...),
    preview_image: Optional[UploadFile] = File(None), 
    db: Session = Depends(get_db) 
):
    if not zip_file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Дозволені тільки файли з розширенням .zip")

    zip_file.file.seek(0, os.SEEK_END)
    file_size = zip_file.file.tell()
    zip_file.file.seek(0)
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Файл архіву занадто великий!")

    cleaned_name = " ".join(student_name.split()).strip()
    
    temp_student = db.query(models.Student).filter(models.Student.student_name.ilike(cleaned_name)).first()
    project_idx = len(temp_student.projects) + 1 if temp_student else 1
    folder_base = slugify(cleaned_name) or cleaned_name.lower().replace(" ", "-")
    folder_name = f"{folder_base}-project-{project_idx}"
    upload_dir = os.path.join("static", "uploaded_sites", folder_name)

    if os.path.exists(upload_dir):
        shutil.rmtree(upload_dir)
    os.makedirs(upload_dir)

    zip_path = os.path.join(upload_dir, zip_file.filename)
    with open(zip_path, "wb") as buffer:
        buffer.write(await zip_file.read())

    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            for member in zip_ref.infolist():
                if member.is_dir(): continue
                if member.file_size > MAX_UNZIP_SIZE:
                    raise HTTPException(status_code=400, detail="Розпакований вміст перевищує ліміт")
                _, ext = os.path.splitext(member.filename.lower())
                if ext and ext not in ALLOWED_EXTENSIONS:
                    raise HTTPException(status_code=400, detail="Архів містить заборонений тип файлу")
            zip_ref.extractall(upload_dir)
    finally:
        if os.path.exists(zip_path):
            os.remove(zip_path)

    saved_preview_url = None
    if preview_image and preview_image.filename:
        _, img_ext = os.path.splitext(preview_image.filename.lower())
        if img_ext in ['.png', '.jpg', '.jpeg', '.webp', '.svg']:
            img_name = f"preview{img_ext}"
            img_path = os.path.join(upload_dir, img_name)
            with open(img_path, "wb") as img_buffer:
                img_buffer.write(await preview_image.read())
            saved_preview_url = f"/static/uploaded_sites/{folder_name}/{img_name}"

    relative_index_path = None
    for root, dirs, files in os.walk(upload_dir):
        if "index.html" in files:
            relative_path = os.path.relpath(os.path.join(root, "index.html"), start=".")
            relative_index_path = "/" + relative_path.replace("\\", "/")
            break

    if not relative_index_path:
        if os.path.exists(upload_dir):
            shutil.rmtree(upload_dir)
        raise HTTPException(status_code=400, detail="В архіві не знайдено index.html")

    student = db.query(models.Student).filter(models.Student.student_name.ilike(cleaned_name)).first()
    if student:
        student.student_role = project_role
        student.student_tg = telegram
        student.student_email = email
    else:
        student = models.Student(student_name=cleaned_name, student_role=project_role, student_tg=telegram, student_email=email)
        db.add(student)
        db.flush()

    new_project = models.Project(
        site_name=site_name,               
        site_preview=saved_preview_url,   
        student_bio=student_bio,
        site_path=relative_index_path,
        student_id=student.id,
        project_role=project_role
    )
    db.add(new_project)
    db.commit()

    return RedirectResponse(url="/portfolios", status_code=303)





@app.get("/api/check-student")
async def check_student(name: str = Query(...), db: Session = Depends(get_db)):
    cleaned_name = " ".join(name.split()).strip()
    if not cleaned_name:
        return {"exists": False}
        
    student = db.query(models.Student).filter(models.Student.student_name.ilike(cleaned_name)).first()
    if student:
        return {
            "exists": True, 
            "project_count": len(student.projects),
            "role": student.student_role,
            "tg": student.student_tg,
            "email": student.student_email
        }
    return {"exists": False}







@app.get("/student/{student_id}", response_class=HTMLResponse)
async def read_student_profile(student_id: int, request: Request, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Студента не знайдено")
        
    unique_techs = set()
    for project in student.projects:
        if project.project_role:
            unique_techs.add(project.project_role.upper())
            
    return templates.TemplateResponse(
        request=request, 
        name="profile.html", 
        context={
            "student": student,
            "tech_stack": sorted(list(unique_techs))
        }
    )
