import { api } from "./api.js";

export const listFavorites = () => api("/favorites");

export const addFavorite = (id) => api(`/favorites/${id}`, { method: "PUT" });

export const removeFavorite = (id) =>
  api(`/favorites/${id}`, { method: "DELETE" });
