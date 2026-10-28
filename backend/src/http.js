export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const send = (res, status, data, headers = {}) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(status === 204 ? undefined : JSON.stringify(data));
};
export const readJson = (req) => {
  if (!req.is("application/json"))
    throw new HttpError(415, "JSON_REQUIRED", "请使用 JSON 格式提交");
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
    throw new HttpError(400, "INVALID_JSON", "请求内容不是有效 JSON 对象");
  return req.body;
};
export const number = (value, label, min, max, integer = false) => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean" ||
    !["string", "number"].includes(typeof value) ||
    (typeof value === "string" && !value.trim())
  )
    throw new HttpError(400, "INVALID_INPUT", `${label}不能为空`);
  const result = Number(value);
  if (
    !Number.isFinite(result) ||
    result < min ||
    result > max ||
    (integer && !Number.isInteger(result))
  )
    throw new HttpError(
      400,
      "INVALID_INPUT",
      `${label}需要在 ${min} 到 ${max} 之间${integer ? "的整数" : ""}`,
    );
  return result;
};
export const text = (value, label, min = 1, max = 100) => {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw new HttpError(
      400,
      "INVALID_INPUT",
      `${label}需要 ${min}–${max} 个字符`,
    );
  return value.trim();
};
