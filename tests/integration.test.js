import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { app } from "../backend/src/app.js";
import { initialize } from "../backend/src/init-db.js";
import { pool, query } from "../backend/src/db.js";
import { config } from "../backend/src/config.js";
let server, base, demo, admin, restaurantId;
const search = "/restaurants?lng=121.4737&lat=31.2304&radius=1500";
async function request(
  path,
  { method = "GET", body, cookie, headers = {} } = {},
) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body:
      body !== undefined
        ? typeof body === "string"
          ? body
          : JSON.stringify(body)
        : undefined,
  });
  const data = response.status === 204 ? null : await response.json();
  return { status: response.status, data, headers: response.headers };
}
async function start() {
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
}
async function stop() {
  await new Promise((resolve) => server.close(resolve));
}
before(async () => {
  assert.match(
    config.databaseUrl,
    /\/where_to_eat_test$/,
    "Integration tests require the isolated test database",
  );
  await initialize();
  await query("TRUNCATE restaurants RESTART IDENTITY CASCADE");
  await start();
});
after(async () => {
  if (server?.listening) await stop();
  await pool.end();
});
test("Express + PostgreSQL + Postman HTTP integration", async (t) => {
  await t.test(
    "database health, no keys/passwords in browser config",
    async () => {
      assert.equal((await request("/health")).data.status, "ok");
      const result = await request("/config");
      assert.deepEqual(Object.keys(result.data).sort(), [
        "demoUsername",
        "mapConfigured",
      ]);
    },
  );
  await t.test(
    "missing map configuration is explicit, never synthetic fallback",
    async () => {
      const saved = config.amapKey;
      config.amapKey = "";
      try {
        const result = await request(search);
        assert.equal(result.status, 503);
        assert.equal(result.data.error.code, "MAP_NOT_CONFIGURED");
      } finally {
        config.amapKey = saved;
      }
      assert.equal(
        (await query("SELECT count(*) FROM restaurants")).rows[0].count,
        "0",
      );
    },
  );
  await t.test(
    "invalid search params fail before invoking provider",
    async () => {
      for (const url of [
        "/restaurants",
        `${search}&budget=-1`,
        `${search}&page=1.5`,
        `${search}&lng=500`,
        `${search}&lng=1&lng=2`,
      ])
        assert.equal((await request(url)).status, 400);
    },
  );
  await t.test(
    "geocoding uses HTTP and returns GCJ02, unknown address is 404",
    async () => {
      const result = await request("/location?address=test-place");
      assert.equal(result.status, 200);
      assert.equal(result.data.location.lng, 121.4737);
      assert.equal((await request("/location?address=not-found")).status, 404);
    },
  );
  await t.test(
    "upstream empty/error/html/timeout are distinct, without fallback writes",
    async () => {
      assert.equal((await request(`${search}&keyword=empty`)).data.total, 0);
      for (const keyword of ["upstream-error", "html-error"])
        assert.equal(
          (await request(`${search}&keyword=${keyword}`)).status,
          502,
        );
      assert.equal((await request(`${search}&keyword=timeout`)).status, 504);
      assert.equal(
        (await query("SELECT count(*) FROM restaurants")).rows[0].count,
        "0",
      );
    },
  );
  await t.test(
    "real backend imports test HTTP candidates, unknown prices remain null and IDs stable",
    async () => {
      const result = await request(search);
      assert.equal(result.status, 200);
      assert.equal(result.data.total, 2);
      restaurantId = result.data.items[0].id;
      assert.equal(result.data.items[1].price, null);
      assert.equal(result.data.items[0].scoreBreakdown.reviews, 0);
      assert.equal((await request(`${search}&budget=40`)).data.total, 1);
      assert.equal((await request(`${search}&budget=20`)).data.total, 0);
      assert.equal((await request(search)).data.items[0].id, restaurantId);
      const columns = await query(
        "SELECT column_name FROM information_schema.columns WHERE table_name='restaurants'",
      );
      assert.ok(!columns.rows.some((r) => r.column_name.includes("distance")));
    },
  );
  await t.test(
    "anonymous writes/admin are protected; no registration route",
    async () => {
      assert.equal((await request("/favorites")).status, 401);
      assert.equal(
        (await request(`/favorites/${restaurantId}`, { method: "PUT" })).status,
        401,
      );
      assert.equal((await request("/admin/restaurants")).status, 401);
      assert.equal(
        (await request("/register", { method: "POST", body: {} })).status,
        404,
      );
    },
  );
  await t.test(
    "login validates credentials and stores only token/password hashes",
    async () => {
      assert.equal(
        (
          await request("/session", {
            method: "POST",
            body: { username: "demo", password: "wrong" },
          })
        ).status,
        401,
      );
      const result = await request("/session", {
        method: "POST",
        body: { username: "demo", password: process.env.DEMO_PASSWORD },
      });
      assert.equal(result.status, 200);
      assert.match(result.headers.get("set-cookie"), /HttpOnly/);
      assert.match(result.headers.get("set-cookie"), /SameSite=Lax/);
      demo = result.headers.get("set-cookie").split(";")[0];
      const stored = await query("SELECT token_hash FROM sessions");
      assert.ok(!stored.rows.some((r) => demo.includes(r.token_hash)));
      assert.equal(
        (await request("/session", { cookie: demo })).data.user.username,
        "demo",
      );
      assert.equal(
        (await request("/favorites", { cookie: "wte_session=forged" })).status,
        401,
      );
      const resultAdmin = await request("/session", {
        method: "POST",
        body: { username: "admin", password: process.env.ADMIN_PASSWORD },
      });
      admin = resultAdmin.headers.get("set-cookie").split(";")[0];
      assert.equal(
        (await request("/admin/restaurants", { cookie: demo })).status,
        403,
      );
    },
  );
  await t.test(
    "favorite upsert/delete idempotent, foreign restaurant rejected",
    async () => {
      for (let i = 0; i < 2; i++)
        assert.equal(
          (
            await request(`/favorites/${restaurantId}`, {
              method: "PUT",
              cookie: demo,
            })
          ).status,
          204,
        );
      assert.equal(
        (await request("/favorites", { cookie: demo })).data.items.length,
        1,
      );
      assert.equal(
        (await request("/favorites", { cookie: admin })).data.items.length,
        0,
      );
      assert.equal(
        (
          await request("/favorites/2147483647", {
            method: "PUT",
            cookie: demo,
          })
        ).status,
        404,
      );
    },
  );
  await t.test(
    "review upsert keeps creation timestamp; users cannot delete another review",
    async () => {
      const path = `/restaurants/${restaurantId}/review`;
      assert.equal(
        (
          await request(path, {
            method: "PUT",
            cookie: demo,
            body: { rating: 6, content: "真实体验测试内容" },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request(path, {
            method: "PUT",
            cookie: demo,
            body: { rating: 4, content: "短" },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request(path, {
            method: "PUT",
            cookie: demo,
            body: { rating: 4, content: "测试夹具内容，不代表真实体验" },
          })
        ).status,
        200,
      );
      const created = (
        await query("SELECT created_at FROM reviews")
      ).rows[0].created_at.toISOString();
      await request(path, {
        method: "PUT",
        cookie: demo,
        body: { rating: 5, content: "更新测试内容，不代表真实体验" },
      });
      assert.equal(
        (await query("SELECT count(*) FROM reviews")).rows[0].count,
        "1",
      );
      assert.equal(
        (
          await query("SELECT created_at FROM reviews")
        ).rows[0].created_at.toISOString(),
        created,
      );
      await request(path, { method: "DELETE", cookie: admin });
      assert.equal(
        (await request(`/restaurants/${restaurantId}`, { cookie: demo })).data
          .ownReview.rating,
        5,
      );
      assert.equal(
        (await request(`/restaurants/${restaurantId}`)).data.restaurant
          .reviewCount,
        1,
      );
    },
  );
  await t.test(
    "malformed/oversized/wrong content and cross-origin mutations are rejected",
    async () => {
      assert.equal(
        (await request("/session", { method: "POST", body: "{" })).status,
        400,
      );
      assert.equal(
        (
          await request("/session", {
            method: "POST",
            body: { username: "x", password: "x".repeat(20000) },
          })
        ).status,
        413,
      );
      assert.equal(
        (
          await request("/session", {
            method: "POST",
            body: "abc",
            headers: { "Content-Type": "text/plain" },
          })
        ).status,
        415,
      );
      assert.equal(
        (
          await request(`/favorites/${restaurantId}`, {
            method: "DELETE",
            cookie: demo,
            headers: { Origin: "https://attacker.invalid" },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request(`/favorites/${restaurantId}`, {
            method: "DELETE",
            cookie: demo,
            headers: { "Sec-Fetch-Site": "cross-site" },
          })
        ).status,
        403,
      );
    },
  );
  await t.test(
    "admin overrides survive map refresh; hidden stores disappear from search/favorites",
    async () => {
      const body = {
        name: "管理覆盖测试（非真实餐厅）",
        address: "测试地址",
        price: 25,
        hidden: true,
      };
      assert.equal(
        (
          await request(`/admin/restaurants/${restaurantId}`, {
            method: "PATCH",
            cookie: admin,
            body,
          })
        ).status,
        200,
      );
      assert.equal((await request(search)).data.total, 1);
      assert.equal(
        (await request("/favorites", { cookie: demo })).data.items.length,
        0,
      );
      assert.equal((await request(`/restaurants/${restaurantId}`)).status, 404);
      await request(`/admin/restaurants/${restaurantId}`, {
        method: "PATCH",
        cookie: admin,
        body: { ...body, hidden: false },
      });
      const result = await request(`${search}&budget=30`);
      assert.equal(result.data.items[0].name, body.name);
      assert.equal(result.data.items[0].price, 25);
      assert.equal(
        (await request("/admin/reviews", { cookie: admin })).data.total,
        1,
      );
    },
  );
  await t.test(
    "sessions, favorites, reviews persist across HTTP server restart",
    async () => {
      await stop();
      await start();
      assert.equal(
        (await request("/session", { cookie: demo })).data.user.username,
        "demo",
      );
      assert.equal(
        (await request("/favorites", { cookie: demo })).data.items.length,
        1,
      );
      assert.equal(
        (await request(`/restaurants/${restaurantId}`)).data.restaurant
          .reviewCount,
        1,
      );
    },
  );
  await t.test("admin moderation and own-favorite deletion work", async () => {
    const reviewId = (await request("/admin/reviews", { cookie: admin })).data
      .items[0].id;
    assert.equal(
      (
        await request(`/admin/reviews/${reviewId}`, {
          method: "DELETE",
          cookie: admin,
        })
      ).status,
      204,
    );
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await request(`/favorites/${restaurantId}`, {
            method: "DELETE",
            cookie: demo,
          })
        ).status,
        204,
      );
    assert.equal(
      (await request("/favorites", { cookie: demo })).data.items.length,
      0,
    );
    assert.equal(
      (await request(`/restaurants/${restaurantId}`)).data.restaurant
        .reviewCount,
      0,
    );
  });
  await t.test(
    "expired session is rejected and logout revokes token",
    async () => {
      await query(
        "UPDATE sessions SET expires_at=now()-interval '1 minute' WHERE user_id=(SELECT id FROM users WHERE username='demo')",
      );
      assert.equal((await request("/favorites", { cookie: demo })).status, 401);
      assert.equal(
        (await request("/session", { method: "DELETE", cookie: admin })).status,
        204,
      );
      assert.equal(
        (await request("/admin/restaurants", { cookie: admin })).status,
        401,
      );
    },
  );
  await t.test("invalid login throttles after ten attempts", async () => {
    for (let i = 0; i < 10; i++)
      assert.equal(
        (
          await request("/session", {
            method: "POST",
            body: { username: "nonexistent", password: "wrong" },
          })
        ).status,
        401,
      );
    assert.equal(
      (
        await request("/session", {
          method: "POST",
          body: { username: "nonexistent", password: "wrong" },
        })
      ).status,
      429,
    );
  });
});
