from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ItemConfig(BaseModel):
    rank: int = Field(..., description="Rank number for countdown")
    title: str = Field(..., min_length=1, description="Title of the item")
    source: str = Field(..., min_length=1, description="URL or uploaded file id")
    start: float = Field(0.0, ge=0.0, description="Start offset in seconds")
    end: Optional[float] = Field(None, description="End offset in seconds")
    duration: Optional[float] = Field(None, gt=0.0, description="Clip duration in seconds")

    @model_validator(mode="after")
    def validate_start_end(self):
        if self.end is not None:
            if self.end <= self.start:
                raise ValueError(
                    f"Item rank {self.rank}: end time ({self.end}s) must be greater than start time ({self.start}s)"
                )
        return self


class VideoConfig(BaseModel):
    title: str = Field("TOP RANKING", min_length=1, description="Main title of the video")
    width: int = Field(1920, gt=0, le=3840, description="Video width in pixels")
    height: int = Field(1080, gt=0, le=3840, description="Video height in pixels")
    accent: str = Field("yellow", description="Accent color for titles")
    bg_color: str = Field("0x141414", description="Hex or name of background color")
    bg_image: Optional[str] = Field(None, description="Uploaded file ID or null")
    bgm: Optional[str] = Field(None, description="Uploaded background music ID or null")
    bgm_volume: float = Field(0.25, ge=0.0, le=2.0, description="Background music volume")
    clip_volume: float = Field(1.0, ge=0.0, le=2.0, description="Item clip volume")
    intro_seconds: float = Field(3.0, gt=0.0, le=60.0, description="Intro duration in seconds")
    clip_seconds: float = Field(8.0, gt=0.0, le=300.0, description="Default item clip duration")
    font: Optional[str] = Field(None, description="Uploaded font ID or null")
    items: List[ItemConfig] = Field(..., min_length=1, description="List of ranked items")

    @field_validator("items")
    @classmethod
    def validate_unique_ranks(cls, items: List[ItemConfig]) -> List[ItemConfig]:
        if not items:
            raise ValueError("At least 1 item is required")
        ranks = [item.rank for item in items]
        if len(ranks) != len(set(ranks)):
            duplicates = [r for r in ranks if ranks.count(r) > 1]
            raise ValueError(f"Duplicate ranks found: {sorted(list(set(duplicates)))}")
        return items


class JobState(BaseModel):
    id: str
    status: JobStatus = JobStatus.QUEUED
    progress: int = Field(0, ge=0, le=100)
    message: str = "Job queued"
    error: Optional[str] = None
    output_file: Optional[str] = None
