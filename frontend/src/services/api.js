export const api = async (path, options = {}) => {
  const response = await fetch(`${import.meta.env.BASE_URL}api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(data?.error?.message || "请求未完成，请检查网络后重试");
  return data;
};
