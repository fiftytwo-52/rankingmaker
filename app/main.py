import shutil
import uuid
from pathlib import Path
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.deps import check_dependencies
from app.jobs import job_manager
from app.models import VideoConfig

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "app" / "static"
UPLOADS_DIR = BASE_DIR / "data" / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Ranking Video Maker")

# Mount static and uploads directories
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.get("/api/health")
def health_check():
    return check_dependencies()


@app.post("/api/upload")
def upload_file(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix
    file_id = f"{uuid.uuid4().hex[:12]}{ext}"
    dest_path = UPLOADS_DIR / file_id

    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        file.file.close()

    return {"id": file_id, "filename": file.filename}


@app.post("/api/jobs")
def create_job_endpoint(cfg: VideoConfig):
    job = job_manager.create_job(cfg)
    return {"job_id": job.job_id}


@app.get("/api/jobs/{id}")
def get_job_endpoint(id: str):
    job = job_manager.get_job(id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.to_dict()


@app.get("/api/jobs/{id}/download")
def download_job_output(id: str):
    job = job_manager.get_job(id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    output_path = Path(job.output_file) if job.output_file else BASE_DIR / "jobs" / id / "output.mp4"
    if not output_path.is_file():
        raise HTTPException(status_code=404, detail="Output file not found or not ready")

    return FileResponse(
        path=output_path,
        media_type="video/mp4",
        filename=f"ranking_{id}.mp4",
    )


@app.post("/api/jobs/{id}/cancel")
def cancel_job_endpoint(id: str):
    success = job_manager.cancel_job(id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    job = job_manager.get_job(id)
    return {"message": "Job cancelled", "status": job.status.value if job else "cancelled"}


@app.delete("/api/jobs/{id}")
def delete_job_endpoint(id: str):
    success = job_manager.delete_job(id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Job deleted", "id": id}


@app.get("/")
def read_root():
    return FileResponse(STATIC_DIR / "index.html")
