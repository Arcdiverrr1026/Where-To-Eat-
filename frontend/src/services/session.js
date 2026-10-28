import { api } from "./api.js";

export const login = (username, password) =>
  api("/session", { method: "POST", body: { username, password } });

export const logout = () => api("/session", { method: "DELETE" });
