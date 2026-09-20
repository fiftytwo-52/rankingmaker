from enum import Enum
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator, model_validator


class OverlayElementConfig(BaseModel):
    id: str = Field(..., description="Unique element ID")
    type: Literal["text", "image", "sticker", "emoji"] = Field("text", description="Element type")
    content: str = Field(..., description="Text content, image path/URL, or emoji symbol")
    target: Literal["intro", "clip", "global"] = Field("clip", description="Target segment")
    clip_index: Optional[int] = Field(None, ge=0, description="0-indexed clip index if target is clip")
    start_time: float = Field(0.0, ge=0.0, le=3600.0, description="Start offset in seconds")
    end_time: float = Field(3.0, ge=0.0, le=3600.0, description="End offset in seconds")
    pos_x: float = Field(50.0, ge=0.0, le=100.0, description="X position percentage (0-100)")
    pos_y: float = Field(50.0, ge=0.0, le=100.0, description="Y position percentage (0-100)")
    scale: float = Field(1.0, ge=0.1, le=10.0, description="Scale factor or font size ratio")
    font_size: Optional[int] = Field(None, ge=12, le=300, description="Optional custom font size for text")
    color: str = Field("#ffffff", description="Text color")
    bg_color: Optional[str] = Field(None, description="Optional background color for text box")
    animation: Literal["none", "pop", "fade"] = Field("pop", description="Entrance animation")

    @model_validator(mode="after")
    def validate_times(self) -> "OverlayElementConfig":
        if self.end_time <= self.start_time:
            self.end_time = self.start_time + 1.0
        return self


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TitleWord(BaseModel):
    word: str = Field(..., min_length=1, description="Word text")
    color: str = Field("white", description="Color name or hex code for this word")


class ItemConfig(BaseModel):
    rank: int = Field(..., description="Rank number for countdown")
    title: str = Field(..., min_length=1, description="Title of the item")
    source: str = Field(..., min_length=1, description="URL or uploaded file id")
    start: float = Field(0.0, ge=0.0, description="Start offset in seconds")
    end: Optional[float] = Field(None, description="End offset in seconds")
    duration: Optional[float] = Field(None, gt=0.0, description="Clip duration in seconds")
    volume: Optional[float] = Field(None, ge=0.0, le=2.0, description="Individual clip volume override (0.0 to 2.0)")

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
    title_words: Optional[List[TitleWord]] = Field(None, description="Optional word-by-word custom colors for the title")
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
    clip_fit: str = Field("fit", description="Clip framing: fit (contain), fill (cover), stretch, blur (blurred padding), or card")
    font: Optional[str] = Field(None, description="Uploaded font ID or font family name")
    transitions: bool = Field(True, description="Enable smooth clip transitions")
    item_label_position: str = Field("bottom", description="Position of item label: bottom, left, or right")
    title_font_size: int = Field(68, ge=16, le=350, description="Font size for main video title")
    item_font_size: int = Field(52, ge=16, le=250, description="Font size for item clip title label")
    title_bg_style: str = Field("none", description="Background style for title text: none, dark, solid, or accent")
    title_shadow: bool = Field(True, description="Enable shadow/outline on title text")
    item_bg_style: str = Field("dark", description="Background style for item label: none, dark, solid, or accent")
    item_shadow: bool = Field(True, description="Enable shadow/outline on item label")
    color_grading_preset: str = Field("none", description="Preset: none, vibrant, cinematic, warm_vintage, cool_noir, neon_punch, film_matte")
    color_contrast: float = Field(1.0, ge=0.5, le=2.0, description="Contrast multiplier")
    color_saturation: float = Field(1.0, ge=0.0, le=3.0, description="Saturation multiplier")
    color_brightness: float = Field(0.0, ge=-0.3, le=0.3, description="Brightness offset")
    color_warmth: float = Field(0.0, ge=-1.0, le=1.0, description="Warmth / color temperature (-1.0 to 1.0)")
    show_rank_ladder: bool = Field(False, description="Display persistent rank numbers ladder overlay")
    rank_ladder_position: str = Field("left", description="Position of rank ladder: left or right")
    elements: List[OverlayElementConfig] = Field(default_factory=list, description="Overlay timed elements (text, image, sticker, emoji)")
    items: List[ItemConfig] = Field(..., min_length=1, description="List of ranked items")

    @field_validator("color_grading_preset")
    @classmethod
    def validate_color_preset(cls, v: str) -> str:
        val = str(v).lower().strip()
        presets = ["none", "vibrant", "cinematic", "warm_vintage", "cool_noir", "neon_punch", "film_matte"]
        if val not in presets:
            return "none"
        return val

    @field_validator("rank_ladder_position")
    @classmethod
    def validate_ladder_pos(cls, v: str) -> str:
        val = str(v).lower().strip()
        if val not in ["left", "right"]:
            return "left"
        return val

    @field_validator("clip_fit")
    @classmethod
    def validate_clip_fit(cls, v: str) -> str:
        val = str(v).lower().strip()
        if val not in ["fit", "fill", "stretch", "blur", "card"]:
            return "fit"
        return val

    @field_validator("item_label_position")
    @classmethod
    def validate_label_pos(cls, v: str) -> str:
        val = str(v).lower().strip()
        if val not in ["bottom", "left", "right"]:
            return "bottom"
        return val

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
