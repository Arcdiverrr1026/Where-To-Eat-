import { api } from "./api.js";

export const findLocation = (address) =>
  api(`/location?address=${encodeURIComponent(address)}`);

export const searchRestaurants = ({ location, filters, page = 1 }) => {
  const params = new URLSearchParams({
    lng: location.lng,
    lat: location.lat,
    ...filters,
    page,
  });
  return api(`/restaurants?${params}`);
};

export const saveReview = (id, body) =>
  api(`/restaurants/${id}/review`, { method: "PUT", body });

export const deleteReview = (id) =>
  api(`/restaurants/${id}/review`, { method: "DELETE" });
