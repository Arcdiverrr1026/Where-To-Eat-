import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { query } from "./db.js";
import { config } from "./config.js";
import { HttpError, text } from "./http.js";
const scrypt = promisify(scryptCallback);
const ttl = 7 * 24 * 60 * 60;
export const hashPassword = async (password) => {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
};
export const verifyPassword = async (password, hash) => {
  const [salt, stored] = hash.split(":");
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(stored, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
};
const tokenHash = (token) => {
  return createHash("sha256").update(token).digest("hex");
};
const sessionToken = (req) => {
  return (
    req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("wte_session="))
      ?.slice(12) || ""
  );
};
export const getUser = async (req) => {
  const token = sessionToken(req);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows } = await query(
    "SELECT u.id, u.username, u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at > now()",
    [tokenHash(token)],
  );
  return rows[0] || null;
};
export const requireUser = (user, admin = false) => {
  if (!user) throw new HttpError(401, "LOGIN_REQUIRED", "请先登录演示账号");
  if (admin && user.role !== "admin")
    throw new HttpError(403, "FORBIDDEN", "此操作需要管理员权限");
};
export const cookie = (token = "") => {
  return `wte_session=${token}; Path=${config.cookiePath}; HttpOnly; SameSite=Lax; Max-Age=${token ? ttl : 0}${config.origin.startsWith("https:") ? "; Secure" : ""}`;
};
const failures = new Map();
const dummyHash = await hashPassword(randomBytes(32).toString("hex"));
export const login = async (body, req) => {
  const username = text(body.username, "用户名", 1, 40);
  const password = text(body.password, "密码", 1, 128);
  const now = Date.now();
  for (const [key, entry] of failures)
    if (entry.until < now) failures.delete(key);
  const attempt = failures.get(username) || {
    count: 0,
    until: now + 15 * 60 * 1000,
  };
  if (attempt.count >= 10)
    throw new HttpError(429, "LOGIN_LIMIT", "尝试次数过多，请 15 分钟后重试");
  const { rows } = await query("SELECT * FROM users WHERE username=$1", [
    username,
  ]);
  const user = rows[0];
  const valid = await verifyPassword(
    password,
    user?.password_hash || dummyHash,
  );
  if (!user || !valid) {
    if (failures.size >= 1000 && !failures.has(username))
      failures.delete(failures.keys().next().value);
    attempt.count += 1;
    failures.set(username, attempt);
    throw new HttpError(401, "INVALID_CREDENTIALS", "用户名或密码不正确");
  }
  failures.delete(username);
  const token = randomBytes(32).toString("hex");
  await query(
    "DELETE FROM sessions WHERE expires_at <= now() OR token_hash=$1",
    [tokenHash(sessionToken(req))],
  );
  await query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+ interval '7 days')",
    [tokenHash(token), user.id],
  );
  return {
    user: { id: user.id, username: user.username, role: user.role },
    token,
  };
};
export const logout = async (req) => {
  await query("DELETE FROM sessions WHERE token_hash=$1", [
    tokenHash(sessionToken(req)),
  ]);
};
