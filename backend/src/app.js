import express from "express";
import { config } from "./config.js";
import { HttpError, send } from "./http.js";
import { getUser } from "./auth.js";
import { router } from "./routes.js";
export const app = express();
app.disable("x-powered-by");
app.use((req, _res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    (req.headers["sec-fetch-site"] === "cross-site" ||
      (req.headers.origin && req.headers.origin !== config.origin))
  )
    throw new HttpError(
      403,
      "ORIGIN_REJECTED",
      "请求来源不受信任，请从本站重试",
    );
  next();
});
app.use(express.json({ limit: "16kb" }));
app.use(async (req, _res, next) => {
  req.user = await getUser(req);
  next();
});
app.use("/api", router);
app.use((_req, _res, next) =>
  next(new HttpError(404, "NOT_FOUND", "接口不存在")),
);
app.use((error, _req, res, _next) => {
  if (error.type === "entity.parse.failed")
    error = new HttpError(400, "INVALID_JSON", "请求内容不是有效 JSON 对象");
  else if (error.type === "entity.too.large")
    error = new HttpError(413, "BODY_TOO_LARGE", "提交内容过大");
  else if (!error.status || !error.code) {
    console.error("Request failed:", error.code || error.name);
    error = new HttpError(500, "INTERNAL_ERROR", "服务暂时不可用，请稍后重试");
  }
  if (!res.headersSent)
    send(res, error.status, {
      error: { code: error.code, message: error.message },
    });
  else res.end();
});
