import { query, pool } from "./db.js";
import { nearby } from "./amap.js";
import { recommend } from "./recommendation.js";
import { HttpError } from "./http.js";
const columns = `r.id, r.source_id AS "sourceId", coalesce(r.name_override,r.name) AS name,
 coalesce(r.address_override,r.address) AS address, r.category, r.lng, r.lat,
 CASE WHEN r.price_overridden THEN r.price_override ELSE r.price END AS price,
 r.hours, r.phone, r.hidden, r.updated_at AS "updatedAt",
 (SELECT count(*)::int FROM reviews v WHERE v.restaurant_id=r.id) AS "reviewCount",
 (SELECT round(avg(v.rating),2)::float FROM reviews v WHERE v.restaurant_id=r.id) AS "averageRating"`;
export const serialize = (row) => {
  return { ...row, price: row.price === null ? null : Number(row.price) };
};
export const getRestaurant = async (id, includeHidden = false) => {
  const { rows } = await query(
    `SELECT ${columns} FROM restaurants r WHERE r.id=$1 ${includeHidden ? "" : "AND NOT r.hidden"}`,
    [id],
  );
  if (!rows[0])
    throw new HttpError(
      404,
      "RESTAURANT_NOT_FOUND",
      "这家餐厅不存在或已被隐藏",
    );
  return serialize(rows[0]);
};
export const searchRestaurants = async (options) => {
  const candidates = await nearby(options);
  // A single transaction avoids a partially cached search when a write fails.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const r of candidates)
      await client.query(
        `INSERT INTO restaurants(source_id,name,address,category,lng,lat,price,hours,phone)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(source_id) DO UPDATE SET
      name=excluded.name,address=excluded.address,category=excluded.category,lng=excluded.lng,lat=excluded.lat,
      price=excluded.price,hours=excluded.hours,phone=excluded.phone,updated_at=now()`,
        [
          r.sourceId,
          r.name,
          r.address,
          r.category,
          r.lng,
          r.lat,
          r.price,
          r.hours,
          r.phone,
        ],
      );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  const { rows } = await query(
    `SELECT ${columns} FROM restaurants r WHERE r.source_id=ANY($1::text[]) AND NOT r.hidden`,
    [candidates.map((r) => r.sourceId)],
  );
  const ranked = recommend(rows.map(serialize), options);
  return {
    items: ranked.slice((options.page - 1) * 12, options.page * 12),
    total: ranked.length,
    page: options.page,
    pageSize: 12,
    candidateLimit: 25,
  };
};
export const restaurantDetails = async (id, userId) => {
  const restaurant = await getRestaurant(id);
  const { rows: reviews } = await query(
    `SELECT v.id,v.user_id AS "userId",u.username,v.rating,v.content,v.created_at AS "createdAt",v.updated_at AS "updatedAt" FROM reviews v JOIN users u ON u.id=v.user_id WHERE v.restaurant_id=$1 ORDER BY v.updated_at DESC,v.id DESC LIMIT 100`,
    [id],
  );
  const own = userId
    ? await query(
        'SELECT id,rating,content,created_at AS "createdAt",updated_at AS "updatedAt" FROM reviews WHERE restaurant_id=$1 AND user_id=$2',
        [id, userId],
      )
    : { rows: [] };
  return { restaurant, reviews, ownReview: own.rows[0] || null };
};
export const favorites = async (userId) => {
  const { rows } = await query(
    `SELECT ${columns} FROM restaurants r JOIN favorites f ON r.id=f.restaurant_id WHERE f.user_id=$1 AND NOT r.hidden ORDER BY f.created_at DESC,r.id DESC`,
    [userId],
  );
  return rows.map(serialize);
};
export const adminRestaurants = async (page) => {
  const { rows } = await query(
    `SELECT ${columns} FROM restaurants r ORDER BY r.id DESC LIMIT 20 OFFSET $1`,
    [(page - 1) * 20],
  );
  const total = await query("SELECT count(*)::int AS total FROM restaurants");
  return {
    items: rows.map(serialize),
    total: total.rows[0].total,
    page,
    pageSize: 20,
  };
};
