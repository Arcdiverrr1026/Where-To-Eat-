from dataclasses import dataclass


@dataclass
class ScoreResult:
    reputation: int
    authenticity: int
    student_fit: int
    stability: int
    final: int


class ScoringEngine:
    budget_limits = {
        "20以内": 20,
        "50以内": 50,
        "70以内": 70,
        "70以上": None,
    }

    distance_limits = {
        "步行10分钟内": 1000,
        "骑车15分钟内": 2500,
        "3公里内": 3000,
    }

    def calculate_scores(
        self,
        restaurant: dict,
        budget: str,
        distance: str,
        scene: str,
    ) -> ScoreResult:
        reputation = self._calc_reputation(restaurant)
        authenticity = self._calc_authenticity(restaurant)
        student_fit = self._calc_student_fit(restaurant, budget, distance, scene)
        stability = self._calc_stability(restaurant)
        final_score = round(
            reputation * 0.40
            + student_fit * 0.30
            + authenticity * 0.20
            + stability * 0.10
        )
        return ScoreResult(
            reputation=reputation,
            authenticity=authenticity,
            student_fit=student_fit,
            stability=stability,
            final=final_score,
        )

    def within_budget(self, price: int, budget: str) -> bool:
        limit = self.budget_limits[budget]
        return True if limit is None else price <= limit

    def within_distance(self, meters: int, distance: str) -> bool:
        return meters <= self.distance_limits[distance]

    def _calc_reputation(self, restaurant: dict) -> int:
        positive_ratio = restaurant["positive_signals"]
        negative_score = max(0, 100 - restaurant["negative_intensity"])
        detail_score = restaurant["detail_richness"]
        trend_score = restaurant["trend_score"]
        return round(
            positive_ratio * 0.35
            + negative_score * 0.30
            + detail_score * 0.20
            + trend_score * 0.15
        )

    def _calc_authenticity(self, restaurant: dict) -> int:
        template_score = max(0, 100 - restaurant["template_risk"])
        time_score = max(0, 100 - restaurant["time_anomaly"])
        high_score_detail = restaurant["high_score_detail"]
        consistency_score = restaurant["score_consistency"]
        return round(
            template_score * 0.30
            + time_score * 0.20
            + high_score_detail * 0.30
            + consistency_score * 0.20
        )

    def _calc_student_fit(
        self,
        restaurant: dict,
        budget: str,
        distance: str,
        scene: str,
    ) -> int:
        price_score = self._budget_score(restaurant["avg_price"], budget)
        distance_score = self._distance_score(restaurant["distance_meters"], distance)
        value_score = round((restaurant["value_signal"] + restaurant["portion_signal"]) / 2)
        scene_score = self._scene_score(restaurant, scene)
        return round(
            price_score * 0.35
            + distance_score * 0.25
            + value_score * 0.20
            + scene_score * 0.20
        )

    def _calc_stability(self, restaurant: dict) -> int:
        volatility_score = max(0, 100 - restaurant["volatility"])
        focus_score = restaurant["negative_focus"]
        peak_score = max(0, 100 - restaurant["peak_risk"])
        return round(
            volatility_score * 0.40 + focus_score * 0.30 + peak_score * 0.30
        )

    def _budget_score(self, avg_price: int, budget: str) -> int:
        limit = self.budget_limits[budget]
        if limit is None:
            return 90
        if avg_price <= limit:
            gap_ratio = avg_price / limit
            return round(100 - gap_ratio * 25)
        overflow = avg_price - limit
        return max(20, 70 - overflow * 4)

    def _distance_score(self, meters: int, distance: str) -> int:
        limit = self.distance_limits[distance]
        if meters <= limit:
            usage_ratio = meters / limit
            return round(100 - usage_ratio * 30)
        overflow = meters - limit
        return max(10, 60 - overflow // 50)

    def _scene_score(self, restaurant: dict, scene: str) -> int:
        mapping = {"高匹配": 92, "中匹配": 72, "低匹配": 45}
        return mapping.get(restaurant["scene_fit"].get(scene, "中匹配"), 72)

