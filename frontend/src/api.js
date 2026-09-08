export async function request(path, { body, headers, ...options } = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const error = new Error(typeof detail === 'string' ? detail : Array.isArray(detail)
      ? detail.map((item) => item.msg).join('; ') : `请求失败 (${response.status})`);
    error.status = response.status;
    if (response.status === 401 && path.startsWith('/api/library/') && !path.includes('/auth/')) {
      window.dispatchEvent(new Event('library:unauthorized'));
    }
    throw error;
  }
  return data;
}

export function readSession(key, fallback = '') {
  try { return sessionStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

export function writeSession(key, value) {
  try { sessionStorage.setItem(key, value); } catch {}
}
