from collections import OrderedDict
from threading import Lock
from time import monotonic
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.core.config import settings
from app.schemas.library import EntryInput, FavoriteInput, LoginRequest, PlaceSearchInput, RegisterRequest, ShareCodeInput, ShareInput
from app.api.routes import service as restaurant_service
from app.services.library_service import LibraryError, LibraryService


COOKIE_NAME = "wte_session"
library = LibraryService(settings.sqlite_path)
_attempts: OrderedDict[str, list[float]] = OrderedDict()
_attempt_lock = Lock()


def private_request(request: Request, response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    origin = request.headers.get("origin")
    if request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "不允许跨站提交私人数据")
    if origin:
        parsed = urlsplit(origin)
        if parsed.scheme != request.url.scheme or parsed.netloc != request.url.netloc:
            raise HTTPException(403, "请求来源不匹配，请从本站重新打开")


router = APIRouter(prefix="/api/library", tags=["personal-library"], dependencies=[Depends(private_request)])


def require_user(request: Request) -> dict:
    try:
        return library.current_user(request.cookies.get(COOKIE_NAME))
    except LibraryError as exc:
        raise HTTPException(exc.status, str(exc), headers={"Cache-Control": "no-store"}) from exc


def limit_requests(request: Request) -> None:
    now = monotonic()
    client = request.client.host if request.client else "unknown"
    key = f"{client}:{request.url.path}"
    with _attempt_lock:
        hits = [hit for hit in _attempts.pop(key, []) if hit > now - 300]
        if len(hits) >= 30:
            _attempts[key] = hits
            raise HTTPException(429, "操作过于频繁，请五分钟后再试", headers={"Retry-After": "300"})
        _attempts[key] = hits + [now]
        while len(_attempts) > 10000:
            _attempts.popitem(last=False)


def set_session(response: Response, request: Request, token: str) -> None:
    response.set_cookie(COOKIE_NAME, token, httponly=True, secure=request.url.scheme == "https",
                        samesite="strict", max_age=library.SESSION_SECONDS, path="/")


@router.post("/auth/register", status_code=201, dependencies=[Depends(limit_requests)])
def register(payload: RegisterRequest, request: Request, response: Response) -> dict:
    user, token = library.register(payload.username, payload.display_name, payload.password)
    library.logout(request.cookies.get(COOKIE_NAME))
    set_session(response, request, token)
    return user


@router.post("/auth/login", dependencies=[Depends(limit_requests)])
def login(payload: LoginRequest, request: Request, response: Response) -> dict:
    user, token = library.login(payload.username, payload.password)
    library.logout(request.cookies.get(COOKIE_NAME))
    set_session(response, request, token)
    return user


@router.get("/auth/me")
def current_user(user: dict = Depends(require_user)) -> dict:
    return user


@router.post("/auth/logout", status_code=204)
def logout(request: Request, response: Response) -> None:
    library.logout(request.cookies.get(COOKIE_NAME))
    response.delete_cookie(COOKIE_NAME, path="/", httponly=True, samesite="strict", secure=request.url.scheme == "https")


@router.get("/entries")
def entries(user: dict = Depends(require_user)) -> dict:
    items = library.list_entries(user["id"])
    return {"entries": items, "total": len(items)}


@router.get("/community/entries")
def community_entries(author_id: str | None = None) -> dict:
    items = library.public_entries(author_id)
    return {"entries": items, "total": len(items)}


@router.post("/entries", status_code=201, dependencies=[Depends(limit_requests)])
def create_entry(payload: EntryInput, user: dict = Depends(require_user)) -> dict:
    return library.create_entry(user, payload)


@router.get("/entries/{entry_id}")
def get_entry(entry_id: str, user: dict = Depends(require_user)) -> dict:
    return library.get_entry(user["id"], entry_id)


@router.put("/entries/{entry_id}")
def update_entry(entry_id: str, payload: EntryInput, user: dict = Depends(require_user)) -> dict:
    return library.update_entry(user["id"], entry_id, payload)


@router.patch("/entries/{entry_id}/favorite")
def favorite(entry_id: str, payload: FavoriteInput, user: dict = Depends(require_user)) -> dict:
    return library.favorite_entry(user["id"], entry_id, payload.favorite)


@router.delete("/entries/{entry_id}", status_code=204)
def delete_entry(entry_id: str, user: dict = Depends(require_user)) -> None:
    library.delete_entry(user["id"], entry_id)


@router.get("/shares")
def shares(user: dict = Depends(require_user)) -> dict:
    return {"shares": library.list_shares(user["id"])}


@router.post("/shares", status_code=201)
def create_share(payload: ShareInput, user: dict = Depends(require_user)) -> dict:
    return library.create_share(user, payload)


@router.delete("/shares/{share_id}", status_code=204)
def revoke_share(share_id: str, user: dict = Depends(require_user)) -> None:
    library.revoke_share(user["id"], share_id)


@router.post("/share-preview", dependencies=[Depends(limit_requests)])
def preview_share(payload: ShareCodeInput, user: dict = Depends(require_user)) -> dict:
    return library.preview_share(user["id"], payload.code)


@router.post("/share-import", dependencies=[Depends(limit_requests)])
def import_share(payload: ShareCodeInput, user: dict = Depends(require_user)) -> dict:
    return library.import_share(user["id"], payload.code)


@router.post("/places", dependencies=[Depends(limit_requests)])
def search_places(payload: PlaceSearchInput) -> dict:
    candidates, source = restaurant_service.source_service.fetch_candidates(
        lat=payload.lat, lng=payload.lng, category=payload.category,
        radius_meters=payload.max_distance,
    )
    if source != "amap":
        return {"places": [], "source": source, "message": "暂未取得真实餐厅资料，可以手动记录餐厅"}
    places = []
    for item in candidates:
        if item.get("distance_meters", 0) > payload.max_distance:
            continue
        known_price = item.get("avg_price_known", False)
        if payload.max_price is not None and known_price and item.get("avg_price", 0) > payload.max_price:
            continue
        places.append({
            "restaurant_id": item["id"], "restaurant_name": item["name"],
            "category": item.get("category", payload.category), "address": item.get("address", ""),
            "lat": item.get("lat"), "lng": item.get("lng"), "distance_meters": item.get("distance_meters", 0),
            "avg_price": item.get("avg_price") if known_price else None, "source": "amap",
        })
    places.sort(key=lambda item: item["distance_meters"])
    return {"places": places, "source": source, "message": ""}
