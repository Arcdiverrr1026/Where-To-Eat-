# HTTP API contract

Base `/api`. JSON request/response. Errors: `{ "error": { "code": "...", "message": "..." } }`.

| Method       | Path                         | Input                                                                                                  | Result                                                                                     |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| GET          | /health                      | —                                                                                                      | database readiness                                                                         |
| GET          | /config                      | —                                                                                                      | `{mapConfigured, demoUsername}`; never keys or passwords                                   |
| GET          | /session                     | session cookie optional                                                                                | `{user: null or {id,username,role}}`                                                       |
| POST         | /session                     | `{username,password}`                                                                                  | user + HttpOnly, SameSite=Lax session cookie; 401 invalid, 429 throttled                   |
| DELETE       | /session                     | cookie                                                                                                 | 204, revoke session                                                                        |
| GET          | /location?address=...        | 2–100 character address                                                                                | `{location:{lng,lat,label}}`, GCJ-02                                                       |
| GET          | /restaurants?lng=...&lat=... | GCJ-02 required; radius 500–5000 default 1500; keyword max 30; budget optional 1–10000; page default 1 | `{items,total,page,pageSize,candidateLimit}`; 12 items/page from at most 25 map candidates |
| GET          | /restaurants/:id             | —                                                                                                      | `{restaurant,reviews}`; latest 100 reviews                                                 |
| GET          | /favorites                   | login                                                                                                  | `{items}`                                                                                  |
| PUT / DELETE | /favorites/:restaurantId     | login                                                                                                  | 204; idempotent                                                                            |
| PUT          | /restaurants/:id/review      | login; `{rating: integer 1–5,content: 5–500 chars}`                                                    | 200 review; one review per account/store, updates preserve original creation time          |
| DELETE       | /restaurants/:id/review      | login                                                                                                  | 204; only own review                                                                       |
| GET          | /admin/restaurants?page=...  | admin                                                                                                  | paginated restaurants (20/page)                                                            |
| PATCH        | /admin/restaurants/:id       | admin; `{name,address,price: number or null,hidden: boolean}`                                          | restaurant; changes immediately affect search                                              |
| GET          | /admin/reviews?page=...      | admin                                                                                                  | latest reviews, 20/page                                                                    |
| DELETE       | /admin/reviews/:id           | admin                                                                                                  | 204                                                                                        |

No registration. Missing login 401; wrong role 403; unknown/hidden restaurant 404; invalid inputs 400; invalid JSON 400; non-JSON writes 415; body over 16 KB 413. Cross-origin writes 403. Unknown route 404. Unsupported method 404 (Express default). Map not configured 503 MAP_NOT_CONFIGURED; map failure 502 MAP_UNAVAILABLE; timeout 504 MAP_TIMEOUT. No mock fallback.

## Recommendation semantics

Keyword is sent to AMap as a cuisine/food keyword, not inferred taste profiling. Fixed information is upserted by AMap ID. Distance is calculated per search using GCJ-02 coordinates and a great-circle formula; it is straight-line distance, not route time. A radius filter applies locally as well as upstream. Explicit budget excludes unknown-price restaurants. Ranking: proximity 0–80 points + onsite average/5 × 20 points only when there are at least 3 onsite reviews; ties by distance then source ID. Score is an ordering aid, not a probability or quality guarantee. Restaurant reasons and exact score breakdown come from the backend. Provider prices may be absent or out of date; no price inference. Hidden restaurants are excluded, including favorites. Map refresh never overwrites admin overrides.

## Session and deployment

Cookie `wte_session`, 7 days, HttpOnly, SameSite=Lax; Secure when APP_ORIGIN is HTTPS. Only a SHA-256 token hash is persisted. Passwords use salted scrypt. Writes verify Origin against APP_ORIGIN and reject cross-site browser requests. Frontend and API are same-origin behind nginx. No public CORS. Failed logins are limited per account (10 attempts / 15 minutes, in-memory for this single server). Demo account data is shared by all people using that account; it is an evaluation account, not individual identity.
