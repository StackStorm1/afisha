"""Проверки черновика конфигурации зала — порт frontend/src/lib/layoutIssues.js.

Редактор показывает эти ошибки до отправки, но сервер повторяет их: черновик
мог прийти не из редактора. Тексты те же, что у фронта.
"""

from typing import Any

from app.services.hall_geometry import (
    Section,
    row_seat_counts,
    shape_rect,
    zone_for_row,
)


def _title(section: Section) -> str:
    return f"«{section.get('name', '').strip() or 'Без названия'}»"


def _kind_title(section: Section) -> str:
    prefix = "с зоной" if section["kind"] == "standing" else "с сектором"
    return f"{prefix} {_title(section)}"


def _overlaps(a: tuple, b: tuple) -> bool:
    """Касаться краями можно, пересекаться площадью — нет."""
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah


def _outside_canvas(rect: tuple, width: float, height: float) -> bool:
    x, y, w, h = rect
    return x < 0 or y < 0 or x + w > width or y + h > height


def _row_ranges(rows: list[int]) -> str:
    """Номера рядов подряд → «ряд 3», «ряды 9–12», «ряды 1–2, 5»."""
    parts = []
    start = prev = rows[0]
    for row in [*rows[1:], None]:
        if row is not None and row == prev + 1:
            prev = row
            continue
        parts.append(str(start) if start == prev else f"{start}–{prev}")
        start = prev = row
    word = "ряд" if len(rows) == 1 else "ряды"
    return f"{word} {', '.join(parts)}"


def _seated_issues(section: Section, zone_ids: set) -> list[str]:
    generator = section["generator"]
    name = _title(section)

    if not (generator.get("rows_count") or 0) > 0:
        return [f"У {name} нулевая вместимость: нет ни одного ряда"]

    # Между первым и последним рядом число мест растёт линейно, так что
    # пустым может быть только крайний ряд. При одном ряде «последний» не
    # используется.
    issues = []
    single = generator["rows_count"] == 1
    empty_first = not (generator.get("seats_first") or 0) > 0
    empty_last = not single and not (generator.get("seats_last") or 0) > 0
    if empty_first or empty_last:
        if single or (empty_first and empty_last):
            issues.append(f"У {name} нулевая вместимость: в рядах нет мест")
        else:
            edge = "первом" if empty_first else "последнем"
            issues.append(f"У {name} нет мест в {edge} ряду")

    zone_ranges = generator.get("zone_ranges", [])
    uncovered = [
        row
        for row in range(1, len(row_seat_counts(generator)) + 1)
        if zone_for_row(row, zone_ranges) not in zone_ids
    ]
    if uncovered:
        issues.append(f"В {name} {_row_ranges(uncovered)} без ценовой зоны")
    return issues


def _standing_issues(section: Section, zone_ids: set) -> list[str]:
    name = _title(section)
    issues = []
    if not (section.get("capacity") or 0) > 0:
        issues.append(f"У {name} нулевая вместимость")
    if section.get("price_zone_id") not in zone_ids:
        issues.append(f"У {name} не выбрана ценовая зона")
    return issues


def layout_issues(layout: dict[str, Any]) -> list[str]:
    """Тексты ошибок черновика; пустой список — черновик можно публиковать."""
    sections = layout["sections"]
    if not sections:
        return ["В конфигурации нет ни одного сектора"]

    zone_ids = {zone["id"] for zone in layout["price_zones"]}
    rects = [shape_rect(section["shape"]) for section in sections]
    issues = []
    for i, section in enumerate(sections):
        # Пересечение пишется один раз на пару, от сектора ниже по списку.
        for j in range(i):
            if _overlaps(rects[i], rects[j]):
                issues.append(
                    f"{_title(section)} пересекается {_kind_title(sections[j])}"
                )
        if _outside_canvas(rects[i], layout["canvas_width"], layout["canvas_height"]):
            issues.append(f"{_title(section)} выходит за край схемы")
        if section["kind"] == "standing":
            issues.extend(_standing_issues(section, zone_ids))
        else:
            issues.extend(_seated_issues(section, zone_ids))
    return issues
