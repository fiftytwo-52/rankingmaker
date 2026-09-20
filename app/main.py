from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.deps import check_dependencies
from app.jobs import job_manager
from app.models import VideoConfig

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "app" / "static"

app = FastAPI(title="Ranking Video Maker")

# Mount static directory
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/api/health")
def health_check():
    return check_dependencies()


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


@app.get("/")
def read_root():
    return FileResponse(STATIC_DIR / "index.html")
