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
class CommentSummaryResult:
    review_count: int
    positive_comment_ratio: int
    complaint_intensity: int
    detail_coverage: int
    recent_momentum: int
    duplicate_comment_risk: int
    recent_burst_risk: int
    praise_detail_ratio: int
    opinion_spread: int
    value_for_money_signal: int
    portion_signal: int
    queue_pressure: int
    issue_concentration: int
    highlighted_items: list[str]
    caution_items: list[str]
    comment_highlights: list[str]
    caution_notes: list[str]
    comment_overview: list[str]


class CommentSummarizer:
    def summarize(self, reviews: list[dict], fallback: dict) -> CommentSummaryResult:
        if not reviews:
            return CommentSummaryResult(
                review_count=0,
                positive_comment_ratio=52,
                complaint_intensity=12,
                detail_coverage=18,
                recent_momentum=50,
                duplicate_comment_risk=0,
                recent_burst_risk=0,
                praise_detail_ratio=50,
                opinion_spread=60,
                value_for_money_signal=fallback["value_for_money_signal"],
                portion_signal=fallback["portion_signal"],
                queue_pressure=18,
                issue_concentration=40,
                highlighted_items=[],
                caution_items=[],
                comment_highlights=self._empty_comment_highlights(fallback),
                caution_notes=["当前真实评论还不够，建议先看基础信息并等待更多留言。"],
                comment_overview=[
                    "这家店目前还没有积累到足够的真实评论。",
                    "现在看到的内容更多基于基础信息，后续可以等大家继续补充。",
                ],
            )

        texts = [self._normalize(item["content"]) for item in reviews]
        ratings = [int(item.get("rating", 3)) for item in reviews]
        review_count = len(reviews)

        positive_reviews = sum(1 for rating in ratings if rating >= 4)
        negative_reviews = sum(1 for rating in ratings if rating <= 2)
        positive_comment_ratio = round(positive_reviews / review_count * 100)
        complaint_intensity = min(
            100,
            round(negative_reviews / review_count * 100)
            + self._keyword_density(texts, NEGATIVE_KEYWORDS),
        )
        detail_coverage = self._detail_coverage(texts)
        recent_momentum = self._recent_momentum(reviews)
        duplicate_comment_risk = self._duplicate_comment_risk(texts)
        recent_burst_risk = self._recent_burst_risk(reviews)
        praise_detail_ratio = self._praise_detail_ratio(reviews)
        opinion_spread = self._opinion_spread(ratings)
        value_for_money_signal = self._value_for_money_signal(texts, fallback["avg_price"])
        portion_signal = self._portion_signal(texts)
        queue_pressure = self._queue_pressure(texts)
        issue_concentration, caution_items = self._caution_items(texts, fallback["caution_items"])
        highlighted_items = self._highlighted_items(texts, fallback["highlighted_items"])
        comment_highlights = self._comment_highlights(
            texts,
            fallback["comment_highlights"],
            fallback["distance_meters"],
        )
        caution_notes = self._caution_notes(
            caution_items,
            duplicate_comment_risk,
            fallback["caution_notes"],
        )
        comment_overview = self._comment_overview(
            positive_reviews=positive_reviews,
            negative_reviews=negative_reviews,
            review_count=review_count,
            caution_items=caution_items,
            highlighted_items=highlighted_items,
        )

        return CommentSummaryResult(
            review_count=review_count,
            positive_comment_ratio=positive_comment_ratio,
            complaint_intensity=complaint_intensity,
            detail_coverage=detail_coverage,
            recent_momentum=recent_momentum,
            duplicate_comment_risk=duplicate_comment_risk,
            recent_burst_risk=recent_burst_risk,
            praise_detail_ratio=praise_detail_ratio,
            opinion_spread=opinion_spread,
            value_for_money_signal=value_for_money_signal,
            portion_signal=portion_signal,
            queue_pressure=queue_pressure,
            issue_concentration=issue_concentration,
            highlighted_items=highlighted_items,
            caution_items=caution_items,
            comment_highlights=comment_highlights,
            caution_notes=caution_notes,
            comment_overview=comment_overview,
        )

    def _normalize(self, text: str) -> str:
        return text.strip()

    def _keyword_density(self, texts: list[str], keywords: set[str]) -> int:
        hits = sum(1 for text in texts if any(word in text for word in keywords))
        return round(hits / max(len(texts), 1) * 40)

    def _detail_coverage(self, texts: list[str]) -> int:
        detailed = sum(
            1
            for text in texts
            if len(text) >= 10 and any(word in text for word in DISH_KEYWORDS | NEGATIVE_KEYWORDS)
        )
        return max(35, round(detailed / max(len(texts), 1) * 100))

    def _recent_momentum(self, reviews: list[dict]) -> int:
        recent = [item for item in reviews if int(item.get("days_ago", 99)) <= 7]
        if not recent:
            return 65
        recent_positive = sum(1 for item in recent if int(item.get("rating", 3)) >= 4)
        return max(40, round(recent_positive / len(recent) * 100))

    def _duplicate_comment_risk(self, texts: list[str]) -> int:
        counts = Counter(texts)
        duplicate_count = sum(count - 1 for count in counts.values() if count > 1)
        short_generic = sum(
            1
            for text in texts
            if len(text) <= 6 and any(word in text for word in {"好吃", "推荐", "不错"})
        )
        return min(90, round((duplicate_count + short_generic) / max(len(texts), 1) * 100))

    def _recent_burst_risk(self, reviews: list[dict]) -> int:
        clustered = sum(
            1
            for item in reviews
            if int(item.get("days_ago", 99)) <= 3 and int(item.get("rating", 3)) >= 4
        )
        return min(70, round(clustered / max(len(reviews), 1) * 60))

    def _praise_detail_ratio(self, reviews: list[dict]) -> int:
        high_reviews = [item for item in reviews if int(item.get("rating", 3)) >= 4]
        if not high_reviews:
            return 50
        detailed = sum(
            1
            for item in high_reviews
            if len(item.get("content", "")) >= 10
            and any(word in item.get("content", "") for word in DISH_KEYWORDS | POSITIVE_KEYWORDS)
        )
        return round(detailed / len(high_reviews) * 100)

    def _opinion_spread(self, ratings: list[int]) -> int:
        average = sum(ratings) / max(len(ratings), 1)
        variance = sum((rating - average) ** 2 for rating in ratings) / max(len(ratings), 1)
        return max(35, 100 - round(variance * 12))

    def _value_for_money_signal(self, texts: list[str], avg_price: int) -> int:
        base = 84 if avg_price <= 35 else 76 if avg_price <= 50 else 66
        positive = sum(
            1
            for text in texts
            if any(word in text for word in {"性价比高", "划算", "便宜", "价格友好"})
        )
        negative = sum(1 for text in texts if "贵" in text)
        return max(30, min(95, base + positive * 6 - negative * 8))

    def _portion_signal(self, texts: list[str]) -> int:
        positive = sum(1 for text in texts if any(word in text for word in {"分量足", "量也够", "量大"}))
        return min(95, 68 + positive * 8)

    def _queue_pressure(self, texts: list[str]) -> int:
        hits = sum(1 for text in texts if any(word in text for word in {"排队", "等了很久", "高峰", "挤"}))
        return min(90, 20 + hits * 12)

    def _caution_items(self, texts: list[str], fallback: list[str]) -> tuple[int, list[str]]:
        topic_hits: list[str] = []
        for label, markers in NEGATIVE_TOPICS.items():
            if any(any(marker in text for marker in markers) for text in texts):
                topic_hits.append(label)
        if not topic_hits:
            return 65, fallback[:3]
        topic_counter = Counter(topic_hits)
        issue_concentration = min(90, 55 + len(topic_counter) * 8)
        return issue_concentration, topic_hits[:3]

    def _highlighted_items(self, texts: list[str], fallback: list[str]) -> list[str]:
        dishes = [dish for dish in DISH_KEYWORDS if any(dish in text for text in texts)]
        return dishes[:3] if dishes else fallback[:3]

    def _comment_highlights(
        self,
        texts: list[str],
        fallback: list[str],
        distance_meters: int,
    ) -> list[str]:
        highlights: list[str] = []
        if any("分量" in text for text in texts):
            highlights.append("评论里多次提到分量表现不错")
        if any(any(word in text for word in {"好吃", "不错", "稳定"}) for text in texts):
            highlights.append("最近留言里对味道的评价整体偏正向")
        if distance_meters <= 1000:
            highlights.append("离得较近，想去尝试的决策成本不高")
        return highlights[:3] if highlights else fallback[:3]

    def _caution_notes(
        self,
        caution_items: list[str],
        duplicate_comment_risk: int,
        fallback: list[str],
    ) -> list[str]:
        notes = list(caution_items[:2])
        if duplicate_comment_risk >= 30:
            notes.append("部分短评论比较像模板留言，参考时可以多看几条")
        return notes[:3] if notes else fallback[:3]

    def _comment_overview(
        self,
        *,
        positive_reviews: int,
        negative_reviews: int,
        review_count: int,
        caution_items: list[str],
        highlighted_items: list[str],
    ) -> list[str]:
        overview: list[str] = []
        overview.append(
            f"近30天共收集到 {review_count} 条评论，其中偏正向 {positive_reviews} 条、明显吐槽 {negative_reviews} 条。"
        )
        if highlighted_items:
            overview.append(f"评论里较常提到的菜品包括：{'、'.join(highlighted_items[:3])}。")
        if caution_items:
            overview.append(f"当前讨论比较集中的问题有：{'、'.join(caution_items[:3])}。")
        return overview[:3]

    def _empty_comment_highlights(self, fallback: dict) -> list[str]:
        highlights: list[str] = []
        if fallback["distance_meters"] <= 1000:
            highlights.append("离得不远，适合先去试一次再回来补评论")
        if fallback["avg_price"] <= 35:
            highlights.append("价格压力不大，适合作为第一批真实评论样本")
        elif fallback["avg_price"] <= 50:
            highlights.append("预算还算可控，可以先观察同学后续留言")
        highlights.append("目前更缺真实评论，欢迎你补第一条")
        return highlights[:3]
