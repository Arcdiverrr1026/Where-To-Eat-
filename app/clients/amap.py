from dataclasses import dataclass
from json import JSONDecodeError

import httpx

from app.core.config import settings


@dataclass
class AmapRestaurantCandidate:
    source_id: str
    name: str
    category: str
    address: str
    avg_price: int
    business_hours: str
    distance_meters: int
    lng: float | None = None
    lat: float | None = None


class AmapClient:
    base_url = "https://restapi.amap.com/v5/place/around"

    def __init__(self) -> None:
        self.api_key = settings.amap_api_key

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def search_nearby_restaurants(
        self,
        *,
        lat: float,
        lng: float,
        keyword: str,
        radius_meters: int,
        page_size: int,
    ) -> list[AmapRestaurantCandidate]:
        if not self.is_configured():
            return []

        params = {
            "key": self.api_key,
            "location": f"{lng},{lat}",
            "keywords": keyword,
            "radius": radius_meters,
            "page_size": page_size,
            "sortrule": "distance",
            "show_fields": "business,indoor,photos",
        }

        with httpx.Client(timeout=10.0) as client:
            try:
                response = client.get(self.base_url, params=params)
                response.raise_for_status()
                payload = response.json()
            except (httpx.HTTPError, JSONDecodeError, ValueError):
                return []

        if not isinstance(payload, dict):
            return []

        pois = payload.get("pois", [])
        if not isinstance(pois, list):
            return []

        candidates: list[AmapRestaurantCandidate] = []
        for poi in pois:
            if not isinstance(poi, dict):
                continue
            candidates.append(
                AmapRestaurantCandidate(
                    source_id=poi.get("id", ""),
                    name=poi.get("name", "未知店铺"),
                    category=keyword,
                    address=poi.get("address", "地址待补充"),
                    avg_price=self._extract_price(poi),
                    business_hours=self._extract_business_hours(poi),
                    distance_meters=self._extract_distance(poi),
                    lng=self._extract_lng(poi),
                    lat=self._extract_lat(poi),
                )
            )
        return candidates

    def _extract_price(self, poi: dict) -> int:
        business = poi.get("business", {})
        if not isinstance(business, dict):
            return 35
        cost = business.get("cost")
        if isinstance(cost, str) and cost.isdigit():
            return int(cost)
        if isinstance(cost, (int, float)):
            return int(cost)
        return 35

    def _extract_business_hours(self, poi: dict) -> str:
        business = poi.get("business", {})
        if not isinstance(business, dict):
            return "营业时间待确认"
        open_time = business.get("opentime_today") or business.get("opentime_week")
        if isinstance(open_time, str) and open_time.strip():
            return open_time
        return "营业时间待确认"

    def _extract_distance(self, poi: dict) -> int:
        raw_distance = poi.get("distance", 0)
        if isinstance(raw_distance, (int, float)):
            return int(raw_distance)
        if isinstance(raw_distance, str):
            normalized = raw_distance.strip()
            if normalized.isdigit():
                return int(normalized)
        return 0

    def _extract_lng(self, poi: dict) -> float | None:
        lng, _ = self._extract_location_pair(poi)
        return lng

    def _extract_lat(self, poi: dict) -> float | None:
        _, lat = self._extract_location_pair(poi)
        return lat

    def _extract_location_pair(self, poi: dict) -> tuple[float | None, float | None]:
        location = poi.get("location")
        if not isinstance(location, str):
            return None, None
        parts = [item.strip() for item in location.split(",", maxsplit=1)]
        if len(parts) != 2:
            return None, None
        try:
            return float(parts[0]), float(parts[1])
        except ValueError:
            return None, None
