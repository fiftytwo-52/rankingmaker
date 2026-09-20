import json
from pathlib import Path
import threading
import time
import uuid
from typing import Any, Dict, Optional

from app.engine import JobCancelledException, render
from app.models import JobState, JobStatus, VideoConfig


class Job:
    def __init__(self, job_id: str, cfg: VideoConfig, jobs_dir: Path, base_data_dir: Path):
        self.job_id = job_id
        self.cfg = cfg
        self.jobs_dir = jobs_dir
        self.base_data_dir = base_data_dir
        self.job_dir = jobs_dir / job_id
        self.state_file = self.job_dir / "job.json"

        self.status = JobStatus.QUEUED
        self.progress = 0
        self.message = "Job queued"
        self.error: Optional[str] = None
        self.output_file: Optional[str] = None

        self.cancel_event = threading.Event()
        self.thread: Optional[threading.Thread] = None

        self._save_state()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.job_id,
            "status": self.status.value,
            "progress": self.progress,
            "message": self.message,
            "error": self.error,
            "output_file": self.output_file,
        }

    def _save_state(self):
        self.job_dir.mkdir(parents=True, exist_ok=True)
        try:
            with open(self.state_file, "w", encoding="utf-8") as f:
                json.dump(self.to_dict(), f, indent=2)
        except Exception:
            pass

    def update_progress(self, progress: int, message: str):
        if self.cancel_event.is_set():
            return
        self.progress = max(0, min(100, progress))
        self.message = message
        self._save_state()

    def cancel(self):
        if self.status in [JobStatus.DONE, JobStatus.FAILED, JobStatus.CANCELLED]:
            return
        self.cancel_event.set()
        self.status = JobStatus.CANCELLED
        self.message = "Job cancelled by user"
        self._save_state()

    def run(self):
        try:
            self.status = JobStatus.RUNNING
            self.message = "Job started"
            self._save_state()

            out = render(
                cfg=self.cfg,
                job_dir=self.job_dir,
                progress_callback=self.update_progress,
                cancel_flag=self.cancel_event,
                base_data_dir=self.base_data_dir,
            )

            if self.cancel_event.is_set():
                self.status = JobStatus.CANCELLED
                self.message = "Job cancelled"
            else:
                self.status = JobStatus.DONE
                self.progress = 100
                self.message = "Completed"
                self.output_file = str(out.resolve())
        except JobCancelledException as e:
            self.status = JobStatus.CANCELLED
            self.message = str(e)
        except Exception as e:
            self.status = JobStatus.FAILED
            self.error = str(e)
            self.message = f"Failed: {e}"
        finally:
            self._save_state()


class JobManager:
    def __init__(self, base_dir: Path | str = "."):
        self.base_dir = Path(base_dir).resolve()
        self.jobs_dir = self.base_dir / "jobs"
        self.base_data_dir = self.base_dir / "data"
        self.jobs_dir.mkdir(parents=True, exist_ok=True)
        self.base_data_dir.mkdir(parents=True, exist_ok=True)

        self._jobs: Dict[str, Job] = {}
        self._lock = threading.Lock()

    def create_job(self, cfg: VideoConfig) -> Job:
        job_id = uuid.uuid4().hex[:12]
        with self._lock:
            job = Job(
                job_id=job_id,
                cfg=cfg,
                jobs_dir=self.jobs_dir,
                base_data_dir=self.base_data_dir,
            )
            self._jobs[job_id] = job

            # Spawn worker thread
            t = threading.Thread(target=job.run, daemon=True)
            job.thread = t
            t.start()
            return job

    def get_job(self, job_id: str) -> Optional[Job]:
        with self._lock:
            job = self._jobs.get(job_id)
            if job:
                return job

        # Try recovery from jobs/<job_id>/job.json
        state_path = self.jobs_dir / job_id / "job.json"
        if state_path.is_file():
            try:
                with open(state_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                dummy_cfg = VideoConfig(title="Restored Job", items=[{"rank": 1, "title": "X", "source": "x"}])
                restored = Job(
                    job_id=job_id,
                    cfg=dummy_cfg,
                    jobs_dir=self.jobs_dir,
                    base_data_dir=self.base_data_dir,
                )
                restored.status = JobStatus(data.get("status", JobStatus.FAILED.value))
                restored.progress = int(data.get("progress", 0))
                restored.message = str(data.get("message", ""))
                restored.error = data.get("error")
                restored.output_file = data.get("output_file")
                with self._lock:
                    self._jobs[job_id] = restored
                return restored
            except Exception:
                pass
        return None

    def cancel_job(self, job_id: str) -> bool:
        job = self.get_job(job_id)
        if not job:
            return False
        job.cancel()
        return True

    def delete_job(self, job_id: str) -> bool:
        import shutil
        job = self.get_job(job_id)
        if job and job.status == JobStatus.RUNNING:
            job.cancel()
        with self._lock:
            self._jobs.pop(job_id, None)
        job_folder = self.jobs_dir / job_id
        if job_folder.exists():
            shutil.rmtree(job_folder, ignore_errors=True)
            return True
        return False


# Global job manager instance
job_manager = JobManager(Path(__file__).resolve().parent.parent)
