import os
import shutil
import uuid
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from pydantic import BaseModel

from app.deps import check_dependencies
from app.jobs import job_manager
from app.models import VideoConfig

# Load .env if python-dotenv is available (optional)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed — use real env vars or set in shell
BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "app" / "static"
UPLOADS_DIR = BASE_DIR / "data" / "uploads"
DOWNLOADS_DIR = BASE_DIR / "data" / "downloads"
ELEMENTS_DIR = UPLOADS_DIR / "elements"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)
ELEMENTS_DIR.mkdir(parents=True, exist_ok=True)

# Vecteezy credentials — load from environment (set in .env, never hardcode)
DEFAULT_VECTEEZY_API_KEY = os.getenv("VECTEEZY_API_KEY", "")
DEFAULT_VECTEEZY_ACCOUNT_ID = os.getenv("VECTEEZY_ACCOUNT_ID", "")

app = FastAPI(title="Ranking Video Maker")

# Mount static, uploads, and downloads directories
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.mount("/downloads", StaticFiles(directory=DOWNLOADS_DIR), name="downloads")


@app.get("/api/health")
def health_check():
    return check_dependencies()


@app.get("/api/config")
def get_frontend_config():
    """Expose non-secret config to the frontend (credentials come from .env)."""
    return {
        "vecteezy_account_id": DEFAULT_VECTEEZY_ACCOUNT_ID,
        # Only expose key if set — frontend uses it as a pre-fill, user can override
        "vecteezy_api_key": DEFAULT_VECTEEZY_API_KEY,
    }


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


@app.api_route("/api/jobs/{id}/video", methods=["GET", "HEAD"])
def stream_job_output(id: str):
    job = job_manager.get_job(id)
    output_path = Path(job.output_file) if (job and job.output_file) else BASE_DIR / "jobs" / id / "output.mp4"
    if not output_path.is_file():
        raise HTTPException(status_code=404, detail="Video not found or output not ready")

    return FileResponse(
        path=output_path,
        media_type="video/mp4",
        headers={"Content-Disposition": "inline", "Accept-Ranges": "bytes"},
    )


@app.api_route("/api/jobs/{id}/download", methods=["GET", "HEAD"])
def download_job_output(id: str):
    job = job_manager.get_job(id)
    output_path = Path(job.output_file) if (job and job.output_file) else BASE_DIR / "jobs" / id / "output.mp4"
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


class DownloadRequest(BaseModel):
    url: str


@app.post("/api/download-source")
def download_source_endpoint(req: DownloadRequest):
    from app.engine import get_source
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="Empty URL provided")
    try:
        source_path = get_source(url, DOWNLOADS_DIR, UPLOADS_DIR)
        rel_url = f"/downloads/{source_path.name}" if source_path.parent == DOWNLOADS_DIR else f"/uploads/{source_path.name}"
        return {
            "status": "ready",
            "id": source_path.name,
            "filename": source_path.name,
            "url": rel_url,
        }
    except Exception as e:
        logger.error(f"Download error for '{url}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/cleanup-downloads")
def cleanup_downloads_endpoint():
    count = 0
    for f in DOWNLOADS_DIR.glob("*"):
        if f.is_file():
            try:
                f.unlink()
                count += 1
            except Exception:
                pass
    return {"message": "Downloads cleaned up", "count": count}


class VecteezyDownloadRequest(BaseModel):
    resource_id: int
    account_id: Optional[str] = None
    api_key: Optional[str] = None


@app.post("/api/upload-element")
def upload_element_file(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in [".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"]:
        ext = ".png"
    file_id = f"elem_{uuid.uuid4().hex[:12]}{ext}"
    dest_path = ELEMENTS_DIR / file_id

    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        file.file.close()

    return {
        "id": f"elements/{file_id}",
        "filename": file.filename,
        "url": f"/uploads/elements/{file_id}",
    }


@app.get("/api/elements/list")
def list_local_elements():
    """Return all pre-downloaded sticker / element files available locally."""
    IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
    items = []
    if ELEMENTS_DIR.exists():
        for f in sorted(ELEMENTS_DIR.iterdir()):
            if f.is_file() and f.suffix.lower() in IMAGE_EXTS:
                # Derive a human label from the filename
                stem = f.stem  # e.g. vecteezy_fire_59250269
                parts = stem.split("_")
                label = " ".join(p.capitalize() for p in parts[1:-1]) if len(parts) >= 3 else stem
                items.append({
                    "filename": f.name,
                    "url": f"/uploads/elements/{f.name}",
                    "label": label,
                })
    return {"items": items}


@app.get("/api/vecteezy/search")
def search_vecteezy(
    term: str = "sticker",
    content_type: str = "png",
    account_id: Optional[str] = None,
    api_key: Optional[str] = None,
    page: int = 1,
    per_page: int = 24,
):
    import urllib.request
    import urllib.parse
    import urllib.error
    import json

    acc_id = (account_id or DEFAULT_VECTEEZY_ACCOUNT_ID).strip()
    key = (api_key or DEFAULT_VECTEEZY_API_KEY).strip()
    c_type = (content_type or "png").lower().strip()
    if c_type not in ["png", "vector", "photo", "svg"]:
        c_type = "png"

    clean_term = term.strip()
    if not clean_term:
        clean_term = "sticker"

    url = (
        f"https://api.vecteezy.com/v2/{acc_id}/resources"
        f"?term={urllib.parse.quote(clean_term)}"
        f"&content_type={c_type}"
        f"&page={max(1, page)}"
        f"&per_page={min(60, max(1, per_page))}"
    )

    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {key}",
            "User-Agent": "shortsmaker/1.0",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            resources = []
            for r in data.get("resources", []):
                resources.append({
                    "id": r.get("id"),
                    "title": r.get("title") or "Vecteezy Asset",
                    "content_type": r.get("content_type"),
                    "thumbnail_url": r.get("thumbnail_url") or r.get("thumbnail_2x_url") or r.get("preview_url"),
                    "preview_url": r.get("preview_url") or r.get("thumbnail_2x_url"),
                })
            return {
                "page": data.get("page", page),
                "total_resources": data.get("total_resources", len(resources)),
                "resources": resources,
            }
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        raise HTTPException(
            status_code=e.code,
            detail=f"Vecteezy API error ({e.code}): {err_msg[:200]}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to Vecteezy: {str(e)}",
        )


@app.post("/api/vecteezy/download")
def download_vecteezy_resource(req: VecteezyDownloadRequest):
    import urllib.request
    import urllib.error
    import json

    acc_id = (req.account_id or DEFAULT_VECTEEZY_ACCOUNT_ID).strip()
    key = (req.api_key or DEFAULT_VECTEEZY_API_KEY).strip()
    res_id = req.resource_id

    url = f"https://api.vecteezy.com/v2/{acc_id}/resources/{res_id}/download"
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {key}",
            "User-Agent": "shortsmaker/1.0",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        raise HTTPException(
            status_code=e.code,
            detail=f"Vecteezy download error ({e.code}): {err_msg[:200]}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch Vecteezy download link: {str(e)}",
        )

    download_url = data.get("url") or data.get("inline_url") or data.get("thumbnail_url")
    if not download_url:
        raise HTTPException(status_code=500, detail="No download URL returned from Vecteezy")

    # Download actual file
    ext = ".png"
    file_id = f"vecteezy_{res_id}_{uuid.uuid4().hex[:6]}{ext}"
    dest_path = ELEMENTS_DIR / file_id

    dl_req = urllib.request.Request(download_url, headers={"User-Agent": "shortsmaker/1.0"})
    try:
        with urllib.request.urlopen(dl_req, timeout=30) as dl_resp, open(dest_path, "wb") as f_out:
            shutil.copyfileobj(dl_resp, f_out)
    except Exception as e:
        thumb_url = data.get("thumbnail_url") or data.get("thumbnail_2x_url")
        if thumb_url and thumb_url != download_url:
            try:
                t_req = urllib.request.Request(thumb_url, headers={"User-Agent": "shortsmaker/1.0"})
                with urllib.request.urlopen(t_req, timeout=15) as t_resp, open(dest_path, "wb") as f_out:
                    shutil.copyfileobj(t_resp, f_out)
            except Exception:
                raise HTTPException(status_code=500, detail=f"Failed to download asset: {str(e)}")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to download asset: {str(e)}")

    return {
        "status": "ready",
        "id": f"elements/{file_id}",
        "filename": file_id,
        "url": f"/uploads/elements/{file_id}",
    }


@app.get("/api/recent-videos")
def get_recent_videos_endpoint():
    jobs_dir = BASE_DIR / "jobs"
    if not jobs_dir.exists():
        return []
    recent = []
    for j_dir in jobs_dir.iterdir():
        if j_dir.is_dir():
            out_file = j_dir / "output.mp4"
            if out_file.is_file():
                title = j_dir.name
                cfg_file = j_dir / "config.json"
                if cfg_file.is_file():
                    try:
                        import json
                        with open(cfg_file, "r") as cf:
                            c = json.load(cf)
                            title = c.get("title", title)
                    except Exception:
                        pass
                stat = out_file.stat()
                recent.append({
                    "id": j_dir.name,
                    "title": title,
                    "size": stat.st_size,
                    "mtime": stat.st_mtime,
                    "download_url": f"/api/jobs/{j_dir.name}/download",
                })
    recent.sort(key=lambda x: x["mtime"], reverse=True)
    return recent[:20]


@app.delete("/api/jobs/{id}")
def delete_job_endpoint(id: str):
    success = job_manager.delete_job(id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": "Job deleted", "id": id}


@app.get("/")
def read_root():
    return FileResponse(STATIC_DIR / "index.html")
