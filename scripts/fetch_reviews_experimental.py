import argparse
import json
import re
import sys
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import httpx


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.schemas.restaurant import ReviewImportRequest  # noqa: E402
from app.services.review_source_service import ReviewSourceService  # noqa: E402


DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


@dataclass
class NormalizedReview:
    rating: int
    content: str
    days_ago: int


class ExperimentalReviewCrawler:
    def fetch_text(self, url: str) -> str:
        with httpx.Client(headers=DEFAULT_HEADERS, follow_redirects=True, timeout=20.0) as client:
            response = client.get(url)
            response.raise_for_status()
            return response.text

    def parse_reviews(self, html: str) -> list[NormalizedReview]:
        reviews: list[NormalizedReview] = []
        seen: set[tuple[int, str, int]] = set()

        for payload in self._iter_jsonld_payloads(html):
            reviews.extend(self._extract_from_jsonld(payload, seen))

        if not reviews:
            reviews.extend(self._extract_from_inline_json(html, seen))

        return reviews

    def _iter_jsonld_payloads(self, html: str) -> list[Any]:
        matches = re.findall(
            r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
            html,
            flags=re.DOTALL | re.IGNORECASE,
        )
        payloads: list[Any] = []
        for raw in matches:
            raw = raw.strip()
            if not raw:
                continue
            try:
                payloads.append(json.loads(raw))
            except json.JSONDecodeError:
                continue
        return payloads

    def _extract_from_jsonld(
        self,
        payload: Any,
        seen: set[tuple[int, str, int]],
    ) -> list[NormalizedReview]:
        nodes = self._walk_json(payload)
        output: list[NormalizedReview] = []
        for node in nodes:
            if not isinstance(node, dict):
                continue
            if "reviewBody" not in node:
                continue

            rating = self._coerce_rating(
                node.get("reviewRating", {}).get("ratingValue")
                if isinstance(node.get("reviewRating"), dict)
                else node.get("reviewRating")
            )
            content = self._clean_text(node.get("reviewBody", ""))
            days_ago = self._date_to_days_ago(node.get("datePublished"))
            review = self._build_review(rating=rating, content=content, days_ago=days_ago)
            if review is None:
                continue
            key = (review.rating, review.content, review.days_ago)
            if key in seen:
                continue
            seen.add(key)
            output.append(review)
        return output

    def _extract_from_inline_json(
        self,
        html: str,
        seen: set[tuple[int, str, int]],
    ) -> list[NormalizedReview]:
        pattern = re.compile(
            r'"reviewBody"\s*:\s*"(?P<body>.*?)".{0,240}?'
            r'"ratingValue"\s*:\s*"?(?P<rating>\d(?:\.\d+)?)"?'
            r'.{0,240}?'
            r'"datePublished"\s*:\s*"(?P<date>[^"]+)"',
            flags=re.DOTALL,
        )

        output: list[NormalizedReview] = []
        for match in pattern.finditer(html):
            content = self._clean_text(self._decode_json_string(match.group("body")))
            rating = self._coerce_rating(match.group("rating"))
            days_ago = self._date_to_days_ago(match.group("date"))
            review = self._build_review(rating=rating, content=content, days_ago=days_ago)
            if review is None:
                continue
            key = (review.rating, review.content, review.days_ago)
            if key in seen:
                continue
            seen.add(key)
            output.append(review)
        return output

    def _walk_json(self, value: Any) -> list[Any]:
        nodes = [value]
        if isinstance(value, dict):
            for item in value.values():
                nodes.extend(self._walk_json(item))
        elif isinstance(value, list):
            for item in value:
                nodes.extend(self._walk_json(item))
        return nodes

    def _build_review(
        self,
        *,
        rating: int | None,
        content: str,
        days_ago: int | None,
    ) -> NormalizedReview | None:
        if not content or len(content) < 6:
            return None
        safe_rating = rating if rating is not None else 3
        safe_days_ago = days_ago if days_ago is not None else 7
        return NormalizedReview(
            rating=max(1, min(5, safe_rating)),
            content=content,
            days_ago=max(0, safe_days_ago),
        )

    def _coerce_rating(self, value: Any) -> int | None:
        if value is None:
            return None
        try:
            numeric = float(str(value).strip())
        except ValueError:
            return None
        return round(numeric)

    def _date_to_days_ago(self, value: Any) -> int | None:
        if not value:
            return None
        raw = str(value).strip()
        if not raw:
            return None

        date_patterns = (
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S%z",
        )
        parsed_date: date | None = None
        for pattern in date_patterns:
            try:
                parsed = datetime.strptime(raw, pattern)
                parsed_date = parsed.date()
                break
            except ValueError:
                continue

        if parsed_date is None:
            try:
                parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                parsed_date = parsed.astimezone(UTC).date() if parsed.tzinfo else parsed.date()
            except ValueError:
                return None

        delta = date.today() - parsed_date
        return max(0, delta.days)

    def _clean_text(self, value: str) -> str:
        cleaned = (
            value.replace("\\n", " ")
            .replace("\\r", " ")
            .replace("\n", " ")
            .replace("\r", " ")
            .replace("&nbsp;", " ")
        )
        cleaned = re.sub(r"<[^>]+>", " ", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned)
        return cleaned.strip()

    def _decode_json_string(self, value: str) -> str:
        try:
            return json.loads(f'"{value}"')
        except json.JSONDecodeError:
            return value


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="实验性抓取评论脚本。抓取页面后提取评论，并可直接导入项目 SQLite。"
    )
    parser.add_argument("--restaurant-id", required=True, help="项目内的餐厅 id，例如 r001")
    parser.add_argument("--url", help="待抓取页面 URL")
    parser.add_argument("--html-file", help="本地 HTML 文件路径，便于先离线实验")
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="最多保留多少条评论，默认 20",
    )
    parser.add_argument(
        "--output",
        help="将提取结果写入 JSON 文件；不传则打印到标准输出",
    )
    parser.add_argument(
        "--import-to-db",
        action="store_true",
        help="提取后直接调用项目导入服务写入 SQLite",
    )
    return parser.parse_args()


def load_html(args: argparse.Namespace, crawler: ExperimentalReviewCrawler) -> str:
    if args.html_file:
        return Path(args.html_file).read_text(encoding="utf-8")
    if args.url:
        return crawler.fetch_text(args.url)
    raise ValueError("You must provide either --url or --html-file")


def serialize_reviews(reviews: list[NormalizedReview]) -> list[dict[str, Any]]:
    return [
        {
            "rating": review.rating,
            "content": review.content,
            "days_ago": review.days_ago,
        }
        for review in reviews
    ]


def write_output(payload: list[dict[str, Any]], output_path: str | None) -> None:
    serialized = json.dumps(payload, ensure_ascii=False, indent=2)
    if output_path:
        Path(output_path).write_text(serialized + "\n", encoding="utf-8")
        print(f"Wrote {len(payload)} reviews to {output_path}")
        return
    print(serialized)


def import_reviews(restaurant_id: str, payload: list[dict[str, Any]]) -> None:
    service = ReviewSourceService()
    service.import_reviews(
        restaurant_id=restaurant_id,
        review_format="json",
        content=json.dumps(payload, ensure_ascii=False),
    )
    request = ReviewImportRequest(
        restaurant_id=restaurant_id,
        format="json",
        content=json.dumps(payload, ensure_ascii=False),
    )
    print(
        "Imported "
        f"{len(payload)} reviews into SQLite for {request.restaurant_id} via existing review import flow."
    )


def main() -> None:
    args = parse_args()
    crawler = ExperimentalReviewCrawler()
    html = load_html(args, crawler)
    reviews = crawler.parse_reviews(html)[: max(1, args.limit)]
    payload = serialize_reviews(reviews)

    if not payload:
        raise SystemExit(
            "No review-like content was extracted. Try another page, or save the HTML locally and inspect it first."
        )

    write_output(payload, args.output)

    if args.import_to_db:
        import_reviews(args.restaurant_id, payload)


if __name__ == "__main__":
    main()
