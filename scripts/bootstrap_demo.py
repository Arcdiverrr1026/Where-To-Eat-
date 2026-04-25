from app.db.sqlite import SQLiteStore
from app.schemas.restaurant import RestaurantRecommendationRequest, UserLocation
from app.services.recommendation_service import RecommendationService


def main() -> None:
    SQLiteStore()
    service = RecommendationService()
    location = UserLocation(lat=31.2304, lng=121.4737)

    demo_requests = [
        RestaurantRecommendationRequest(
            location=location,
            category="烧烤",
            budget="50以内",
            distance="步行10分钟内",
            scene="宿舍聚餐",
        ),
        RestaurantRecommendationRequest(
            location=location,
            category="家常菜",
            budget="50以内",
            distance="骑车15分钟内",
            scene="一个人吃",
        ),
        RestaurantRecommendationRequest(
            location=location,
            category="火锅",
            budget="70以内",
            distance="3公里内",
            scene="宿舍聚餐",
        ),
        RestaurantRecommendationRequest(
            location=location,
            category="麻辣烫",
            budget="20以内",
            distance="步行10分钟内",
            scene="夜宵",
        ),
    ]

    for payload in demo_requests:
        service.recommend(payload)

    print("Bootstrap complete.")
    print("Database initialized and demo recommendation caches warmed.")


if __name__ == "__main__":
    main()
