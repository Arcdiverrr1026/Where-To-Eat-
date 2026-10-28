import assert from "node:assert/strict";
const base = process.env.SMOKE_URL || "http://localhost:8080";
const request = async (path, options = {}) => {
  const response = await fetch(`${base}${path}`, options);
  const data = response.status === 204 ? null : await response.json();
  return { response, data };
};
const homepage = await fetch(base);
assert.equal(homepage.status, 200);
assert.match(
  homepage.headers.get("content-security-policy"),
  /default-src 'self'/,
);
assert.equal((await request("/api/health")).data.database, "ready");
const configuration = (await request("/api/config")).data;
assert.deepEqual(Object.keys(configuration).sort(), [
  "demoUsername",
  "mapConfigured",
]);
const login = await request("/api/session", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: process.env.APP_ORIGIN || base,
  },
  body: JSON.stringify({
    username: process.env.DEMO_USERNAME || "demo",
    password: process.env.DEMO_PASSWORD,
  }),
});
assert.equal(login.response.status, 200);
const cookie = login.response.headers.get("set-cookie").split(";")[0];
assert.match(login.response.headers.get("set-cookie"), /HttpOnly/);
assert.equal(
  (await request("/api/favorites", { headers: { Cookie: cookie } })).response
    .status,
  200,
);
assert.equal(
  (await request("/api/admin/restaurants", { headers: { Cookie: cookie } }))
    .response.status,
  403,
);
assert.equal(
  (
    await request("/api/session", {
      method: "DELETE",
      headers: { Cookie: cookie, Origin: "https://attacker.invalid" },
    })
  ).response.status,
  403,
);
assert.equal(
  (
    await request("/api/session", {
      method: "DELETE",
      headers: { Cookie: cookie },
    })
  ).response.status,
  204,
);
assert.equal(
  (await request("/api/favorites", { headers: { Cookie: cookie } })).response
    .status,
  401,
);
if (!configuration.mapConfigured) {
  const result = await request("/api/restaurants?lng=121.4737&lat=31.2304");
  assert.equal(result.response.status, 503);
  assert.equal(result.data.error.code, "MAP_NOT_CONFIGURED");
}
console.log(
  `Container smoke checks passed at ${base}; real map configured: ${configuration.mapConfigured}.`,
);
