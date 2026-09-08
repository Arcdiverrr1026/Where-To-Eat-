class ScoringEngine:
    # Budget ranges are cumulative upper bounds:
    # "50以内" = anything ≤ 50, not "21–50".
    budget_ranges = {
        "20以内": (None, 20),
        "50以内": (None, 50),
        "70以内": (None, 70),
        "70以上": (70, None),
    }

    # Allow ~20 % margin over strict distance to avoid clipping restaurants
    # that are just barely outside the boundary.
    distance_limits = {
        "步行10分钟内": 1200,
        "骑车15分钟内": 3000,
        "3公里内": 3600,
    }

    def within_budget(
        self,
        price: int,
        budget: str,
        *,
        price_known: bool = True,
        budget_min: int | None = None,
        budget_max: int | None = None,
    ) -> bool:
        if not price_known:
            return True
        if budget_min is not None or budget_max is not None:
            lower, upper = budget_min, budget_max
        else:
            lower, upper = self.budget_ranges[budget]
        if lower is not None and price < lower:
            return False
        if upper is not None and price > upper:
            return False
        return True

    def within_distance(self, meters: int, distance: str) -> bool:
        return meters <= self.distance_limits[distance]

    def within_route_constraint(
        self,
        *,
        restaurant: dict,
        distance: str,
    ) -> bool:
        # Allow ~20 % margin on time-based routes so borderline restaurants
        # are not silently dropped.
        if distance == "步行10分钟内":
            walking_minutes = restaurant.get("walking_minutes")
            if walking_minutes is not None:
                return int(walking_minutes) <= 12
        if distance == "骑车15分钟内":
            riding_minutes = restaurant.get("riding_minutes")
            if riding_minutes is not None:
                return int(riding_minutes) <= 18
        return self.within_distance(int(restaurant["distance_meters"]), distance)
