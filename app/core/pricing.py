"""Shared price-to-value-signal mapping.

Used by:
- RestaurantSourceService (fallback signal for POIs without reviews)
- CommentSummarizer (base value adjusted by review text sentiment)
"""


def estimate_value_base(avg_price: int) -> int:
    """Return a base value-for-money signal score from average price."""
    if avg_price <= 20:
        return 90
    if avg_price <= 35:
        return 84
    if avg_price <= 50:
        return 76
    if avg_price <= 70:
        return 68
    return 58
