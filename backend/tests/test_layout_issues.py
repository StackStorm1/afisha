from app.services.hall_geometry import rect_shape
from app.services.layout_issues import layout_issues


def _seated(name, rect, *, rows=3, first=5, last=5, ranges=None):
    return {
        "name": name,
        "kind": "seated",
        "shape": rect_shape(*rect),
        "generator": {
            "rows_count": rows,
            "seats_first": first,
            "seats_last": last,
            "numbering": "numeric",
            "zone_ranges": [{"from_row": 1, "to_row": rows, "price_zone_id": "z1"}]
            if ranges is None
            else ranges,
        },
    }


def _standing(name, rect, *, capacity=100, zone="z1"):
    return {
        "name": name,
        "kind": "standing",
        "shape": rect_shape(*rect),
        "capacity": capacity,
        "price_zone_id": zone,
    }


def _layout(*sections):
    return {
        "canvas_width": 840,
        "canvas_height": 640,
        "price_zones": [{"id": "z1"}],
        "sections": list(sections),
    }


def test_valid_layout_has_no_issues():
    assert (
        layout_issues(
            _layout(
                _seated("Партер", (0, 0, 200, 200)),
                _standing("Танцпол", (200, 0, 100, 100)),  # касается краем
            )
        )
        == []
    )


def test_empty_layout():
    assert layout_issues(_layout()) == ["В конфигурации нет ни одного сектора"]


def test_overlap_reported_once_from_lower_section():
    issues = layout_issues(
        _layout(
            _seated("A", (0, 0, 200, 200)),
            _standing("Танцпол", (100, 100, 200, 200)),
        )
    )
    assert issues == ["«Танцпол» пересекается с сектором «A»"]


def test_outside_canvas():
    assert layout_issues(_layout(_seated("A", (700, 0, 200, 200)))) == [
        "«A» выходит за край схемы"
    ]


def test_seated_zero_rows_and_empty_edge_rows():
    assert layout_issues(_layout(_seated("A", (0, 0, 200, 200), rows=0))) == [
        "У «A» нулевая вместимость: нет ни одного ряда"
    ]
    assert layout_issues(_layout(_seated("A", (0, 0, 200, 200), last=0))) == [
        "У «A» нет мест в последнем ряду"
    ]
    assert layout_issues(_layout(_seated("A", (0, 0, 200, 200), first=0, last=0))) == [
        "У «A» нулевая вместимость: в рядах нет мест"
    ]


def test_rows_without_zone():
    section = _seated(
        "A",
        (0, 0, 300, 300),
        rows=12,
        ranges=[
            {"from_row": 3, "to_row": 4, "price_zone_id": "z1"},
            {"from_row": 6, "to_row": 8, "price_zone_id": "gone"},
        ],
    )
    assert layout_issues(_layout(section)) == ["В «A» ряды 1–2, 5–12 без ценовой зоны"]


def test_standing_without_capacity_or_zone():
    assert layout_issues(
        _layout(_standing("", (0, 0, 100, 100), capacity=0, zone=None))
    ) == [
        "У «Без названия» нулевая вместимость",
        "У «Без названия» не выбрана ценовая зона",
    ]
