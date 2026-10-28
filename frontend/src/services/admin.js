import { api } from "./api.js";

export const updateRestaurant = (id, body) =>
  api(`/admin/restaurants/${id}`, { method: "PATCH", body });

export const removeReview = (id) =>
  api(`/admin/reviews/${id}`, { method: "DELETE" });
