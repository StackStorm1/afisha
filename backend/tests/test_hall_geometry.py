"""Паритет с frontend/src/lib/hallLayout.js.

Эталоны сняты запуском generateSeats из фронта под node: если формула на
одной стороне поменяется, подписи или координаты мест разойдутся со
схемой, которую рисует фронт.
"""

from app.services.hall_geometry import (
    generate_seats,
    js_round,
    layout_capacity,
    rect_shape,
    row_label,
    row_seat_counts,
    seat_pitch,
)

TRAPEZOID = {
    "kind": "seated",
    "shape": rect_shape(200, 380, 440, 180),
    "generator": {
        "rows_count": 12,
        "seats_first": 24,
        "seats_last": 36,
        "numbering": "numeric",
        "zone_ranges": [
            {"from_row": 1, "to_row": 2, "price_zone_id": "vip"},
            {"from_row": 3, "to_row": 12, "price_zone_id": "stand"},
        ],
    },
}

LETTERS = {
    "kind": "seated",
    "shape": rect_shape(60, 110, 720, 480),
    "generator": {
        "rows_count": 30,
        "seats_first": 7,
        "seats_last": 2,
        "numbering": "letters",
        "zone_ranges": [{"from_row": 1, "to_row": 20, "price_zone_id": "a"}],
    },
}


def _summary(seats):
    return (
        len(seats),
        js_round(sum(s["x"] for s in seats) * 10) / 10,
        js_round(sum(s["y"] for s in seats) * 10) / 10,
    )


def test_js_round_rounds_half_up():
    assert js_round(30.5) == 31
    assert js_round(2.5) == 3
    assert js_round(-0.5) == 0


def test_row_counts_grow_linearly():
    assert row_seat_counts(TRAPEZOID["generator"]) == [
        24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35, 36,
    ]  # fmt: skip
    assert row_seat_counts({"rows_count": 0, "seats_first": 5}) == []
    assert row_seat_counts({"rows_count": 1, "seats_first": 5, "seats_last": 9}) == [5]


def test_trapezoid_matches_frontend():
    seats = generate_seats(TRAPEZOID)
    assert _summary(seats) == (360, 151200, 175398.6)
    assert seats[0] == {
        "row_label": "1",
        "seat_label": "1",
        "price_zone_id": "vip",
        "x": 285.8,
        "y": 417.8,
    }
    assert seats[-1] == {
        "row_label": "12",
        "seat_label": "36",
        "price_zone_id": "stand",
        "x": 624.2,
        "y": 546.2,
    }
    assert seats[len(seats) // 2 + 3] == {
        "row_label": "7",
        "seat_label": "25",
        "price_zone_id": "stand",
        "x": 525,
        "y": 487.8,
    }


def test_letters_numbering_matches_frontend():
    seats = generate_seats(LETTERS)
    assert _summary(seats) == (135, 56700, 43260)
    assert seats[0]["row_label"] == "А"
    assert (seats[0]["x"], seats[0]["y"]) == (376, 149.3)
    # Ряды после 20-го не покрыты зоной.
    assert seats[-1] == {
        "row_label": "Б2",
        "seat_label": "2",
        "price_zone_id": None,
        "x": 427.3,
        "y": 574.7,
    }


def test_row_label_second_lap():
    assert [row_label(i, "letters") for i in (0, 26, 27, 28, 29)] == [
        "А",
        "Ю",
        "Я",
        "А2",
        "Б2",
    ]
    assert row_label(4) == "5"


def test_pitch_is_zero_without_seats():
    empty = {**TRAPEZOID, "generator": {**TRAPEZOID["generator"], "rows_count": 0}}
    assert seat_pitch(empty) == 0
    assert generate_seats(empty) == []


def test_capacity_counts_seats_and_standing():
    standing = {"kind": "standing", "capacity": 1800}
    assert layout_capacity([TRAPEZOID, LETTERS, standing]) == 360 + 135 + 1800
