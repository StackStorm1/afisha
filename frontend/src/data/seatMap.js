import { uuid } from '../lib/uuid.js';
import { createSeededRandom, hashSeed, pick } from '../lib/seededRandom.js';
import { getSession } from './events.js';
import { getLayout, getSessionHall } from './hallLayouts.js';

// Инвентарь сеанса: каждое место сидячего сектора и каждая единица стоячей
// зоны — отдельная единица со статусом. Стоячая зона вместимостью N — это
// N безымянных единиц: бронь всегда держит конкретные id, наружу у зоны
// отдаются только счётчики.
//
// Единица: { id, sectionId, status: 'free' | 'held' | 'paid', holder }.
// holder — id пользователя, который держит или купил единицу через мок
// заказов. У занятых сидом holder нет: их держат «другие посетители».

const inventories = new Map();

function shuffle(items, random) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function buildInventory(session, hall) {
  const layout = getLayout(hall.layout_id).data;
  const random = createSeededRandom(hashSeed(`${session.id}:${layout.id}`));
  const units = new Map();
  const standingUnits = new Map();

  for (const section of layout.sections) {
    if (section.kind === 'seated') {
      for (const seat of section.seats) {
        units.set(seat.id, { id: seat.id, sectionId: section.id, status: 'free' });
      }
      continue;
    }
    const ids = [];
    for (let i = 0; i < section.capacity; i += 1) {
      const id = uuid(random);
      units.set(id, { id, sectionId: section.id, status: 'free' });
      ids.push(id);
    }
    standingUnits.set(section.id, ids);
  }

  // Продано в каталоге total_seats − seats_left. Занятые раскиданы по залу
  // детерминированно: сид от сеанса, после перезагрузки картина та же.
  const taken = Math.min(
    units.size,
    Math.max(0, session.total_seats - session.seats_left)
  );
  const order = shuffle([...units.keys()], random);
  for (const id of order.slice(0, taken)) {
    units.get(id).status = pick(random, ['held', 'paid']);
  }

  const pricesByZone = new Map(hall.prices.map((p) => [p.price_zone_id, p.price]));
  return { layout, units, standingUnits, pricesByZone };
}

// Инвентарь собирается при первом запросе схемы и живёт до перезагрузки,
// как заказы. Если админ сменил сеансу конфигурацию (это можно, только пока
// продаж нет), инвентарь пересобирается по новой.
function inventoryOf(sessionId) {
  const session = getSession(sessionId);
  if (!session) return null;
  const hall = getSessionHall(sessionId).data;
  const cached = inventories.get(sessionId);
  if (cached && cached.layout.id === hall.layout_id) {
    cached.pricesByZone = new Map(hall.prices.map((p) => [p.price_zone_id, p.price]));
    return cached;
  }
  const inventory = buildInventory(session, hall);
  inventories.set(sessionId, inventory);
  return inventory;
}

// Мок GET /sessions/{id}/seats — SeatMap из спеки схемы зала (§5.1).
// userId заменяет токен: по нему считаются held_by_me.
export function getSeatMap(sessionId, { userId = null } = {}) {
  const inventory = inventoryOf(sessionId);
  if (!inventory) return null;
  const session = getSession(sessionId);
  const { layout, units, standingUnits, pricesByZone } = inventory;

  const availableByZone = new Map(layout.price_zones.map((z) => [z.id, 0]));
  const mine = (unit) =>
    unit.status === 'held' && userId != null && unit.holder === userId;

  const sections = layout.sections.map((section) => {
    const base = {
      id: section.id,
      name: section.name,
      kind: section.kind,
      shape: section.shape,
    };
    if (section.kind === 'seated') {
      return {
        ...base,
        seats: section.seats.map((seat) => {
          const unit = units.get(seat.id);
          if (unit.status === 'free') {
            availableByZone.set(
              seat.price_zone_id,
              availableByZone.get(seat.price_zone_id) + 1
            );
          }
          return {
            id: seat.id,
            row_label: seat.row_label,
            seat_label: seat.seat_label,
            x: seat.x,
            y: seat.y,
            price_zone_id: seat.price_zone_id,
            status: unit.status,
            held_by_me: mine(unit),
          };
        }),
      };
    }
    const sectionUnits = standingUnits.get(section.id).map((id) => units.get(id));
    const available = sectionUnits.filter((unit) => unit.status === 'free').length;
    const zoneId = section.price_zone_id;
    availableByZone.set(zoneId, availableByZone.get(zoneId) + available);
    return {
      ...base,
      price_zone_id: section.price_zone_id,
      capacity: section.capacity,
      available,
      held_by_me: sectionUnits.filter(mine).length,
    };
  });

  return {
    session_id: session.id,
    status: session.status,
    layout: {
      id: layout.id,
      name: layout.name,
      canvas_width: layout.canvas_width,
      canvas_height: layout.canvas_height,
    },
    price_zones: [...layout.price_zones]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((zone) => ({
        id: zone.id,
        name: zone.name,
        sort_order: zone.sort_order,
        price: pricesByZone.get(zone.id),
        available: availableByZone.get(zone.id),
      })),
    sections,
  };
}

// --- Для мока заказов ---

function sectionById(layout, sectionId) {
  return layout.sections.find((section) => section.id === sectionId) ?? null;
}

// Место или единица сеанса с сектором, зоной и ценой — всё, что нужно для
// BookedSeat. null, если такого id в инвентаре сеанса нет.
export function findUnit(sessionId, unitId) {
  const inventory = inventoryOf(sessionId);
  const unit = inventory?.units.get(unitId);
  if (!unit) return null;
  const section = sectionById(inventory.layout, unit.sectionId);
  const seat =
    section.kind === 'seated' ? section.seats.find((s) => s.id === unitId) : null;
  const zoneId = seat ? seat.price_zone_id : section.price_zone_id;
  const zone = inventory.layout.price_zones.find((z) => z.id === zoneId);
  return {
    unit,
    section,
    seat,
    zone,
    price: inventory.pricesByZone.get(zoneId),
  };
}

export function findSection(sessionId, sectionId) {
  const inventory = inventoryOf(sessionId);
  return inventory ? sectionById(inventory.layout, sectionId) : null;
}

// Свободные единицы стоячей зоны по порядку.
export function freeStandingUnits(sessionId, sectionId) {
  const inventory = inventoryOf(sessionId);
  const ids = inventory?.standingUnits.get(sectionId) ?? [];
  return ids.filter((id) => inventory.units.get(id).status === 'free');
}

// Перевести единицы в статус. holder сохраняется за held и paid, при
// освобождении стирается.
export function setUnitsStatus(sessionId, unitIds, status, holder = null) {
  const inventory = inventoryOf(sessionId);
  if (!inventory) return;
  for (const id of unitIds) {
    const unit = inventory.units.get(id);
    if (!unit) continue;
    unit.status = status;
    if (status === 'free') delete unit.holder;
    else if (holder != null) unit.holder = holder;
  }
}

// Только для тестов: забыть состояние всех сеансов.
export function __resetSeatMaps() {
  inventories.clear();
}
