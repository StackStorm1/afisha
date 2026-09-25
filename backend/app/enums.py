from enum import StrEnum


class CategoryCode(StrEnum):
    CONCERT = "CONCERT"
    THEATRE = "THEATRE"
    STANDUP = "STANDUP"
    FESTIVAL = "FESTIVAL"


class UserRole(StrEnum):
    VISITOR = "VISITOR"
    ADMIN = "ADMIN"


class AgeRating(StrEnum):
    ZERO_PLUS = "0+"
    SIX_PLUS = "6+"
    TWELVE_PLUS = "12+"
    SIXTEEN_PLUS = "16+"
    EIGHTEEN_PLUS = "18+"


class PriceCategory(StrEnum):
    STALLS = "stalls"
    BALCONY = "balcony"


class SessionStatus(StrEnum):
    ACTIVE = "active"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class OrderStatus(StrEnum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    CANCELLED = "cancelled"


class BookingStatus(StrEnum):
    HELD = "HELD"
    PAID = "PAID"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class SeatStatus(StrEnum):
    FREE = "free"
    HELD = "held"
    PAID = "paid"
