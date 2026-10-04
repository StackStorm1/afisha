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
    STALLS = "STALLS"
    BALCONY = "BALCONY"


class SessionStatus(StrEnum):
    ACTIVE = "ACTIVE"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


class OrderStatus(StrEnum):
    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class BookingStatus(StrEnum):
    HELD = "HELD"
    PAID = "PAID"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class SeatStatus(StrEnum):
    FREE = "free"
    HELD = "held"
    PAID = "paid"
