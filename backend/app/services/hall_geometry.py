"""Геометрия сегментной схемы зала — порт frontend/src/lib/hallLayout.js.

Сидячий сектор задаётся не списком мест, а параметрами генератора: число
рядов, мест в первом и последнем ряду, нумерация, ценовые зоны по диапазонам
рядов. Места из параметров строит generate_seats. Редактор схемы на фронте
считает их той же формулой, поэтому порт держится за неё буквально:
подписи, число мест и координаты должны совпасть до десятых.

Сектор здесь — словарь в форме API (`kind`: `seated` | `standing`).
"""

import math
from typing import Any, TypedDict

Section = dict[str, Any]


class GeneratedSeat(TypedDict):
    row_label: str
    seat_label: str
    price_zone_id: Any
    x: float
    y: float


# Театральный алфавит без Ё, Й, Ъ, Ы, Ь — их не используют в подписях рядов.
ROW_LETTERS = "АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ"

# Отступы внутри сектора: сверху место под название, по бокам поле.
SECTION_PADDING_TOP = 32
SECTION_PADDING_BOTTOM = 8
SECTION_PADDING_X = 10


def js_round(value: float) -> int:
    """Math.round из JS: половина всегда вверх, а не к чётному, как round()."""
    return math.floor(value + 0.5)


def _round1(value: float) -> float:
    return js_round(value * 10) / 10


def row_label(index: int, numbering: str = "numeric") -> str:
    """Подпись ряда по индексу от сцены (0 — первый ряд).

    Если рядов больше, чем букв, буквы идут по второму кругу с номером:
    «А2», «Б2»…
    """
    if numbering != "letters":
        return str(index + 1)
    letter = ROW_LETTERS[index % len(ROW_LETTERS)]
    lap = index // len(ROW_LETTERS)
    return letter if lap == 0 else f"{letter}{lap + 1}"


def row_seat_counts(generator: dict[str, Any]) -> list[int]:
    """Мест в каждом ряду: от seats_first у сцены до seats_last, равномерно."""
    rows_count = generator.get("rows_count") or 0
    if rows_count <= 0:
        return []
    first = generator.get("seats_first") or 0
    last = generator.get("seats_last") or 0
    counts = []
    for i in range(rows_count):
        t = i / (rows_count - 1) if rows_count > 1 else 0
        counts.append(max(0, js_round(first + (last - first) * t)))
    return counts


def zone_for_row(row_no: int, zone_ranges: list[dict[str, Any]]) -> Any:
    """Ценовая зона ряда (номер с 1) по диапазонам; None — ряд не покрыт."""
    for zone_range in zone_ranges:
        if zone_range["from_row"] <= row_no <= zone_range["to_row"]:
            return zone_range["price_zone_id"]
    return None


def shape_rect(shape: list[list[float]]) -> tuple[float, float, float, float]:
    """Описывающий прямоугольник полигона: (x, y, width, height)."""
    xs = [point[0] for point in shape]
    ys = [point[1] for point in shape]
    x, y = min(xs), min(ys)
    return x, y, max(xs) - x, max(ys) - y


def rect_shape(x: float, y: float, width: float, height: float) -> list[list[float]]:
    return [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]


def seat_pitch(section: Section) -> float:
    """Шаг сетки мест: самый длинный ряд и все ряды должны влезть в контур."""
    _, _, width, height = shape_rect(section["shape"])
    counts = row_seat_counts(section["generator"])
    widest = max([0, *counts])
    if not counts or widest == 0:
        return 0
    by_height = (height - SECTION_PADDING_TOP - SECTION_PADDING_BOTTOM) / len(counts)
    by_width = (width - SECTION_PADDING_X * 2) / widest
    return max(0, min(by_height, by_width))


def generate_seats(section: Section) -> list[GeneratedSeat]:
    """Места сидячего сектора: подписи, ценовая зона и центр места на холсте.

    Ряды центрируются по ширине сектора, места нумеруются слева направо,
    ряды — от сцены.
    """
    generator = section["generator"]
    pitch = seat_pitch(section)
    x, y, width, _ = shape_rect(section["shape"])
    seats: list[GeneratedSeat] = []
    for row_index, count in enumerate(row_seat_counts(generator)):
        label = row_label(row_index, generator.get("numbering", "numeric"))
        zone_id = zone_for_row(row_index + 1, generator.get("zone_ranges", []))
        left = x + (width - count * pitch) / 2
        cy = y + SECTION_PADDING_TOP + row_index * pitch + pitch / 2
        for i in range(count):
            seats.append(
                {
                    "row_label": label,
                    "seat_label": str(i + 1),
                    "price_zone_id": zone_id,
                    "x": _round1(left + i * pitch + pitch / 2),
                    "y": _round1(cy),
                }
            )
    return seats


def section_capacity(section: Section) -> int:
    if section["kind"] == "standing":
        return max(0, section.get("capacity") or 0)
    return sum(row_seat_counts(section["generator"]))


def layout_capacity(sections: list[Section]) -> int:
    return sum(section_capacity(section) for section in sections)
