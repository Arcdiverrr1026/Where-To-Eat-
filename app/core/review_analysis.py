from collections import Counter
from dataclasses import dataclass


POSITIVE_KEYWORDS = {
    "好吃",
    "不错",
    "推荐",
    "稳定",
    "分量足",
    "性价比高",
    "划算",
    "方便",
    "适合",
    "下饭",
}
NEGATIVE_KEYWORDS = {
    "难吃",
    "贵",
    "慢",
    "排队",
    "卫生",
    "咸",
    "油",
    "挤",
    "一般",
    "服务",
}
DISH_KEYWORDS = {
    "羊肉串",
    "烤茄子",
    "炒方便面",
    "红烧肉",
    "番茄炒蛋",
    "干锅土豆片",
    "毛肚",
    "鸭肠",
    "嫩牛肉",
    "牛肉丸",
    "宽粉",
    "娃娃菜",
}
NEGATIVE_TOPICS = {
    "排队久": ["排队", "等了很久", "太挤"],
    "出餐慢": ["出餐慢", "慢"],
    "卫生一般": ["卫生"],
    "口味偏咸": ["咸"],
    "口味偏油": ["油"],
    "服务波动": ["服务"],
    "环境一般": ["环境一般"],
    "座位少": ["座位少", "挤"],
}


@dataclass
class ReviewAnalysisResult:
    review_count: int
    positive_signals: int
    negative_intensity: int
    detail_richness: int
    trend_score: int
    template_risk: int
    time_anomaly: int
    high_score_detail: int
    score_consistency: int
    value_signal: int
    portion_signal: int
    peak_risk: int
    volatility: int
    negative_focus: int
    popular_dishes: list[str]
    common_negatives: list[str]
    recommend_reasons: list[str]
    warning_points: list[str]
    recent_review_summary: list[str]


class ReviewAnalyzer:
    def analyze(self, reviews: list[dict], fallback: dict) -> ReviewAnalysisResult:
        if not reviews:
            return ReviewAnalysisResult(
                review_count=0,
                positive_signals=52,
                negative_intensity=12,
                detail_richness=18,
                trend_score=50,
                template_risk=0,
                time_anomaly=0,
                high_score_detail=50,
                score_consistency=60,
                value_signal=fallback["value_signal"],
                portion_signal=fallback["portion_signal"],
                peak_risk=18,
                volatility=40,
                negative_focus=40,
                popular_dishes=[],
                common_negatives=[],
                recommend_reasons=self._empty_review_reasons(fallback),
                warning_points=["当前真实评价还不够，建议先看基础信息并等待更多反馈。"],
                recent_review_summary=[
                    "这家店目前还没有积累到足够的真实评价。",
                    "现在的判断更多基于基础信息，口碑结论还需要你和同学继续补充。",
                ],
            )

        texts = [self._normalize(item["content"]) for item in reviews]
        ratings = [int(item.get("rating", 3)) for item in reviews]
        review_count = len(reviews)

        positive_reviews = sum(1 for rating in ratings if rating >= 4)
        negative_reviews = sum(1 for rating in ratings if rating <= 2)
        positive_signals = round(positive_reviews / review_count * 100)
        negative_intensity = min(100, round(negative_reviews / review_count * 100) + self._keyword_density(texts, NEGATIVE_KEYWORDS))
        detail_richness = self._detail_richness(texts)
        trend_score = self._trend_score(reviews)
        template_risk = self._template_risk(texts)
        time_anomaly = self._time_anomaly(reviews)
        high_score_detail = self._high_score_detail(reviews)
        score_consistency = self._score_consistency(ratings)
        value_signal = self._value_signal(texts, fallback["avg_price"])
        portion_signal = self._portion_signal(texts)
        peak_risk = self._peak_risk(texts)
        volatility = max(0, 100 - score_consistency)
        negative_focus, common_negatives = self._negative_topics(texts, fallback["common_negatives"])
        popular_dishes = self._popular_dishes(texts, fallback["popular_dishes"])
        recommend_reasons = self._recommend_reasons(texts, fallback["recommend_reasons"], fallback["distance_meters"])
        warning_points = self._warning_points(common_negatives, template_risk, fallback["warning_points"])
        recent_review_summary = self._recent_summary(
            positive_reviews=positive_reviews,
            negative_reviews=negative_reviews,
            review_count=review_count,
            common_negatives=common_negatives,
            popular_dishes=popular_dishes,
        )

        return ReviewAnalysisResult(
            review_count=review_count,
            positive_signals=positive_signals,
            negative_intensity=negative_intensity,
            detail_richness=detail_richness,
            trend_score=trend_score,
            template_risk=template_risk,
            time_anomaly=time_anomaly,
            high_score_detail=high_score_detail,
            score_consistency=score_consistency,
            value_signal=value_signal,
            portion_signal=portion_signal,
            peak_risk=peak_risk,
            volatility=volatility,
            negative_focus=negative_focus,
            popular_dishes=popular_dishes,
            common_negatives=common_negatives,
            recommend_reasons=recommend_reasons,
            warning_points=warning_points,
            recent_review_summary=recent_review_summary,
        )

    def _normalize(self, text: str) -> str:
        return text.strip()

    def _keyword_density(self, texts: list[str], keywords: set[str]) -> int:
        hits = sum(1 for text in texts if any(word in text for word in keywords))
        return round(hits / max(len(texts), 1) * 40)

    def _detail_richness(self, texts: list[str]) -> int:
        detailed = sum(
            1
            for text in texts
            if len(text) >= 10 and any(word in text for word in DISH_KEYWORDS | NEGATIVE_KEYWORDS)
        )
        return max(35, round(detailed / max(len(texts), 1) * 100))

    def _trend_score(self, reviews: list[dict]) -> int:
        recent = [item for item in reviews if int(item.get("days_ago", 99)) <= 7]
        if not recent:
            return 65
        recent_positive = sum(1 for item in recent if int(item.get("rating", 3)) >= 4)
        return max(40, round(recent_positive / len(recent) * 100))

    def _template_risk(self, texts: list[str]) -> int:
        counts = Counter(texts)
        duplicate_count = sum(count - 1 for count in counts.values() if count > 1)
        short_generic = sum(1 for text in texts if len(text) <= 6 and any(word in text for word in {"好吃", "推荐", "不错"}))
        return min(90, round((duplicate_count + short_generic) / max(len(texts), 1) * 100))

    def _time_anomaly(self, reviews: list[dict]) -> int:
        clustered = sum(1 for item in reviews if int(item.get("days_ago", 99)) <= 3 and int(item.get("rating", 3)) >= 4)
        return min(70, round(clustered / max(len(reviews), 1) * 60))

    def _high_score_detail(self, reviews: list[dict]) -> int:
        high_reviews = [item for item in reviews if int(item.get("rating", 3)) >= 4]
        if not high_reviews:
            return 50
        detailed = sum(
            1
            for item in high_reviews
            if len(item.get("content", "")) >= 10 and any(word in item.get("content", "") for word in DISH_KEYWORDS | POSITIVE_KEYWORDS)
        )
        return round(detailed / len(high_reviews) * 100)

    def _score_consistency(self, ratings: list[int]) -> int:
        average = sum(ratings) / max(len(ratings), 1)
        variance = sum((rating - average) ** 2 for rating in ratings) / max(len(ratings), 1)
        return max(35, 100 - round(variance * 12))

    def _value_signal(self, texts: list[str], avg_price: int) -> int:
        base = 84 if avg_price <= 35 else 76 if avg_price <= 50 else 66
        positive = sum(1 for text in texts if any(word in text for word in {"性价比高", "划算", "便宜", "价格友好"}))
        negative = sum(1 for text in texts if "贵" in text)
        return max(30, min(95, base + positive * 6 - negative * 8))

    def _portion_signal(self, texts: list[str]) -> int:
        positive = sum(1 for text in texts if any(word in text for word in {"分量足", "量也够", "量大"}))
        return min(95, 68 + positive * 8)

    def _peak_risk(self, texts: list[str]) -> int:
        hits = sum(1 for text in texts if any(word in text for word in {"排队", "等了很久", "高峰", "挤"}))
        return min(90, 20 + hits * 12)

    def _negative_topics(self, texts: list[str], fallback: list[str]) -> tuple[int, list[str]]:
        topic_hits: list[str] = []
        for label, markers in NEGATIVE_TOPICS.items():
            if any(any(marker in text for marker in markers) for text in texts):
                topic_hits.append(label)
        if not topic_hits:
            return 65, fallback[:3]
        topic_counter = Counter(topic_hits)
        focus_score = min(90, 55 + len(topic_counter) * 8)
        return focus_score, topic_hits[:3]

    def _popular_dishes(self, texts: list[str], fallback: list[str]) -> list[str]:
        dishes = [dish for dish in DISH_KEYWORDS if any(dish in text for text in texts)]
        return dishes[:3] if dishes else fallback[:3]

    def _recommend_reasons(self, texts: list[str], fallback: list[str], distance_meters: int) -> list[str]:
        reasons: list[str] = []
        if any("分量" in text for text in texts):
            reasons.append("评论多次提到分量表现不错")
        if any(any(word in text for word in {"好吃", "不错", "稳定"}) for text in texts):
            reasons.append("近期口味反馈整体偏稳定")
        if distance_meters <= 1000:
            reasons.append("距离较近，决策成本低")
        return reasons[:3] if reasons else fallback[:3]

    def _warning_points(self, common_negatives: list[str], template_risk: int, fallback: list[str]) -> list[str]:
        warnings = list(common_negatives[:2])
        if template_risk >= 30:
            warnings.append("部分高分评论较短，存在模板化倾向")
        return warnings[:3] if warnings else fallback[:3]

    def _recent_summary(
        self,
        *,
        positive_reviews: int,
        negative_reviews: int,
        review_count: int,
        common_negatives: list[str],
        popular_dishes: list[str],
    ) -> list[str]:
        summary: list[str] = []
        summary.append(
            f"近30天共分析 {review_count} 条评论，其中正向评价 {positive_reviews} 条、明显负向评价 {negative_reviews} 条。"
        )
        if popular_dishes:
            summary.append(f"评论里较常被提及的菜品包括：{'、'.join(popular_dishes[:3])}。")
        if common_negatives:
            summary.append(f"当前较集中的风险点是：{'、'.join(common_negatives[:3])}。")
        return summary[:3]

    def _empty_review_reasons(self, fallback: dict) -> list[str]:
        reasons: list[str] = []
        if fallback["distance_meters"] <= 1000:
            reasons.append("离得不远，适合先去试一次再回来补评价")
        if fallback["avg_price"] <= 35:
            reasons.append("价格压力不大，适合作为第一批真实评价样本")
        elif fallback["avg_price"] <= 50:
            reasons.append("预算还算可控，可以先观察同学后续反馈")
        reasons.append("目前更缺真实评价，欢迎你补第一条口碑")
        return reasons[:3]
