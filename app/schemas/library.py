from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator


ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


class LibraryModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class RegisterRequest(LibraryModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_-]+$")
    display_name: str = Field(min_length=1, max_length=40)
    password: Annotated[str, StringConstraints(strip_whitespace=False, min_length=10, max_length=128)]


class LoginRequest(LibraryModel):
    username: str = Field(min_length=3, max_length=32)
    password: Annotated[str, StringConstraints(strip_whitespace=False, min_length=1, max_length=128)]


class EntryInput(LibraryModel):
    restaurant_name: ShortText
    restaurant_id: str = Field(default="", max_length=160)
    category: str = Field(default="其他", max_length=40)
    address: str = Field(default="", max_length=300)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    visited_on: date
    rating: int = Field(ge=1, le=5)
    content: str = Field(min_length=1, max_length=5000)
    spend: float | None = Field(default=None, ge=0, le=100000)
    tags: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]] = Field(default_factory=list, max_length=10)
    would_return: Literal["yes", "no", "unsure"] = "unsure"
    favorite: bool = False
    is_public: bool = False

    @model_validator(mode="after")
    def validate_entry(self) -> "EntryInput":
        if (self.lat is None) != (self.lng is None):
            raise ValueError("经纬度必须同时填写或同时留空")
        if self.visited_on > date.today():
            raise ValueError("用餐日期不能晚于今天")
        if self.is_public and self.lat is None:
            raise ValueError("公开到美食地图需要餐厅位置，请先从地图选择餐厅")
        self.tags = list(dict.fromkeys(self.tags))
        return self


class ShareInput(LibraryModel):
    title: str = Field(min_length=1, max_length=80)
    entry_ids: list[str] = Field(min_length=1, max_length=100)
    expires_in_days: Literal[1, 7, 30] = 7

    @model_validator(mode="after")
    def unique_entries(self) -> "ShareInput":
        self.entry_ids = list(dict.fromkeys(self.entry_ids))
        return self


class ShareCodeInput(LibraryModel):
    code: str = Field(min_length=10, max_length=80)


class FavoriteInput(LibraryModel):
    favorite: bool


class PlaceSearchInput(LibraryModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    category: str = Field(default="餐厅", min_length=1, max_length=40)
    max_distance: int = Field(default=3000, ge=100, le=50000)
    max_price: int | None = Field(default=None, ge=0, le=100000)
