import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HallScheme from './HallScheme.jsx';
import { listEventSessions, listEvents } from '../../data/events.js';
import { getSeatMap } from '../../data/seatMap.js';
import { sectionBounds, sectionSummary, zoneColors } from '../../lib/seatScheme.js';

// По сеансу на каждую площадку: у залов разные шаг мест и поле до рамки.
function seatMapsByVenue() {
  const byVenue = new Map();
  for (const event of listEvents({ per_page: 500 }).data) {
    for (const session of listEventSessions(event.id)) {
      if (!byVenue.has(session.venue.name)) byVenue.set(session.venue.name, session.id);
    }
  }
  return [...byVenue].map(([venue, sessionId]) => [venue, getSeatMap(sessionId)]);
}

function renderScheme(seatMap) {
  const zonesById = new Map(seatMap.price_zones.map((zone) => [zone.id, zone]));
  return render(
    <HallScheme
      seatMap={seatMap}
      colors={zoneColors(seatMap.price_zones)}
      summaries={
        new Map(
          seatMap.sections.map((section) => [
            section.id,
            sectionSummary(section, zonesById),
          ])
        )
      }
    />
  );
}

describe('схема зала: подписи рядов', () => {
  it.each(seatMapsByVenue())(
    '%s — между рамкой сектора и первым местом ряда',
    (_venue, seatMap) => {
      const { container } = renderScheme(seatMap);
      for (const section of seatMap.sections.filter((s) => s.kind === 'seated')) {
        const group = container.querySelector(`[data-section-id="${section.id}"]`);
        const left = sectionBounds(section).x;
        const seats = [...group.querySelectorAll('rect')].map((rect) => ({
          x: Number(rect.getAttribute('x')),
          cy: Number(rect.getAttribute('y')) + Number(rect.getAttribute('height')) / 2,
        }));
        for (const label of group.querySelectorAll('text[dominant-baseline="central"]')) {
          const x = Number(label.getAttribute('x'));
          const y = Number(label.getAttribute('y'));
          const rowLeft = Math.min(
            ...seats.filter((seat) => Math.abs(seat.cy - y) < 0.01).map((seat) => seat.x)
          );
          const half =
            (label.textContent.length * 0.6 * Number(label.getAttribute('font-size'))) /
            2;
          expect(x - half).toBeGreaterThan(left);
          expect(x + half).toBeLessThan(rowLeft);
        }
      }
    }
  );
});
