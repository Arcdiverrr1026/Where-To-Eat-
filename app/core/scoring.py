class ScoringEngine:
    budget_ranges = {
        "20以内": (None, 20),
        "50以内": (21, 50),
        "70以内": (51, 70),
        "70以上": (70, None),
    }

    distance_limits = {
        "步行10分钟内": 1000,
        "骑车15分钟内": 2500,
        "3公里内": 3000,
    }

    def within_budget(self, price: int, budget: str, *, price_known: bool = True) -> bool:
        if not price_known:
            return True
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
        if distance == "步行10分钟内":
            walking_minutes = restaurant.get("walking_minutes")
            if walking_minutes is not None:
                return int(walking_minutes) <= 10
        if distance == "骑车15分钟内":
            riding_minutes = restaurant.get("riding_minutes")
            if riding_minutes is not None:
                return int(riding_minutes) <= 15
        return self.within_distance(int(restaurant["distance_meters"]), distance)
