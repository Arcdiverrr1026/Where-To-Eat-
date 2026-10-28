import express from "express";
import { config } from "./config.js";
import { query } from "./db.js";
import { HttpError, send, readJson, number, text } from "./http.js";
import { requireUser, login, logout, cookie } from "./auth.js";
import { geocode } from "./amap.js";
import {
  searchRestaurants,
  restaurantDetails,
  getRestaurant,
  favorites,
  adminRestaurants,
} from "./restaurants.js";

export const router = express.Router();
const requireLogin = (req, _res, next) => {
  requireUser(req.user);
  next();
};
const requireAdmin = (req, _res, next) => {
  requireUser(req.user, true);
  next();
};
const id = (req) => {
  return number(req.params.id, "ID", 1, 2147483647, true);
};
const page = (req) => {
  return number(req.query.page ?? 1, "页码", 1, 100000, true);
};

router.get("/health", async (_req, res) => {
  await query("SELECT 1");
  send(res, 200, { status: "ok", database: "ready" });
});
router.get("/config", (_req, res) =>
  send(res, 200, {
    mapConfigured: Boolean(config.amapKey),
    demoUsername: config.demoUsername,
  }),
);
router.get("/session", (req, res) => send(res, 200, { user: req.user }));
router.post("/session", async (req, res) => {
  const result = await login(readJson(req), req);
  send(res, 200, { user: result.user }, { "Set-Cookie": cookie(result.token) });
});
router.delete("/session", async (req, res) => {
  await logout(req);
  send(res, 204, null, { "Set-Cookie": cookie() });
});
router.get("/location", async (req, res) =>
  send(res, 200, {
    location: await geocode(text(req.query.address, "地点", 2, 100)),
  }),
);
router.get("/restaurants", async (req, res) => {
  const p = req.query;
  const options = {
    lng: number(p.lng, "经度", -180, 180),
    lat: number(p.lat, "纬度", -90, 90),
    radius: number(p.radius ?? 1500, "范围", 500, 5000, true),
    keyword: p.keyword ? text(p.keyword, "口味", 1, 30) : "",
    budget:
      p.budget !== undefined && p.budget !== ""
        ? number(p.budget, "预算", 1, 10000)
        : null,
    page: number(p.page ?? 1, "页码", 1, 100, true),
  };
  send(res, 200, await searchRestaurants(options));
});
router.get("/restaurants/:id", async (req, res) =>
  send(res, 200, await restaurantDetails(id(req), req.user?.id)),
);
router.get("/favorites", requireLogin, async (req, res) =>
  send(res, 200, { items: await favorites(req.user.id) }),
);
router.put("/favorites/:id", requireLogin, async (req, res) => {
  const restaurantId = id(req);
  await getRestaurant(restaurantId);
  await query(
    "INSERT INTO favorites(user_id,restaurant_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [req.user.id, restaurantId],
  );
  send(res, 204);
});
router.delete("/favorites/:id", requireLogin, async (req, res) => {
  await query("DELETE FROM favorites WHERE user_id=$1 AND restaurant_id=$2", [
    req.user.id,
    id(req),
  ]);
  send(res, 204);
});
router.put("/restaurants/:id/review", requireLogin, async (req, res) => {
  const restaurantId = id(req);
  await getRestaurant(restaurantId);
  const body = readJson(req);
  const rating = number(body.rating, "评分", 1, 5, true);
  const content = text(body.content, "评价", 5, 500);
  const { rows } = await query(
    `INSERT INTO reviews(user_id,restaurant_id,rating,content) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,restaurant_id) DO UPDATE SET rating=excluded.rating,content=excluded.content,updated_at=now() RETURNING id,rating,content`,
    [req.user.id, restaurantId, rating, content],
  );
  send(res, 200, rows[0]);
});
router.delete("/restaurants/:id/review", requireLogin, async (req, res) => {
  await query("DELETE FROM reviews WHERE restaurant_id=$1 AND user_id=$2", [
    id(req),
    req.user.id,
  ]);
  send(res, 204);
});
router.use("/admin", requireAdmin);
router.get("/admin/restaurants", async (req, res) =>
  send(res, 200, await adminRestaurants(page(req))),
);
router.patch("/admin/restaurants/:id", async (req, res) => {
  const restaurantId = id(req);
  await getRestaurant(restaurantId, true);
  const body = readJson(req);
  const name = text(body.name, "店名", 1, 150);
  const address = text(body.address, "地址", 1, 300);
  const price =
    body.price === null ? null : number(body.price, "人均价格", 0, 10000);
  if (typeof body.hidden !== "boolean")
    throw new HttpError(400, "INVALID_INPUT", "隐藏状态必须是布尔值");
  await query(
    "UPDATE restaurants SET name_override=$1,address_override=$2,price_override=$3,price_overridden=true,hidden=$4 WHERE id=$5",
    [name, address, price, body.hidden, restaurantId],
  );
  send(res, 200, await getRestaurant(restaurantId, true));
});
router.get("/admin/reviews", async (req, res) => {
  const currentPage = page(req);
  const { rows } = await query(
    `SELECT v.id,v.rating,v.content,u.username,coalesce(r.name_override,r.name) AS "restaurantName",v.created_at AS "createdAt" FROM reviews v JOIN users u ON v.user_id=u.id JOIN restaurants r ON r.id=v.restaurant_id ORDER BY v.created_at DESC,v.id DESC LIMIT 20 OFFSET $1`,
    [(currentPage - 1) * 20],
  );
  const total = await query("SELECT count(*)::int AS total FROM reviews");
  send(res, 200, {
    items: rows,
    total: total.rows[0].total,
    page: currentPage,
    pageSize: 20,
  });
});
router.delete("/admin/reviews/:id", async (req, res) => {
  await query("DELETE FROM reviews WHERE id=$1", [id(req)]);
  send(res, 204);
});
