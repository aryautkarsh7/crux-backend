/**
 * Which "areas" are real localities. Doctar's locality field is free text: next to "Andheri West" it holds
 * building names, floors, wings and the city's own name. Pages that count areas ("Andheri West has the
 * most") only use the clean ones, so a street or a floor never shows up as a neighbourhood.
 */

/** A building, floor, landmark or facility name, not a neighbourhood. */
const NOT_AN_AREA =
  /\d|\b(floor|wing|society|soc|building|bldg|complex|plot|opp|opposite|near|behind|above|tower|towers|apartment|apt|flat|shop|office|hospital|clinic|nursing|home|centre|center)\b/i;

export type AreaCount = { name: string; count: number };

/**
 * True for the city's known localities, and for other names that read like a locality (no building words,
 * at most three words) and appear at least three times. A single odd entry never becomes an area.
 */
export function isCleanArea(
  name: string | undefined,
  count: number,
  cityName: string,
  known: Set<string>,
) {
  const n = (name ?? '').trim();
  if (n.length < 3 || n.length > 32) return false;
  const key = n.toLowerCase();
  if (key === cityName.toLowerCase()) return false;
  if (known.has(key)) return true;
  return count >= 3 && n.split(/\s+/).length <= 3 && !NOT_AN_AREA.test(n);
}

/** Counts per area name, cleaned and sorted by count then name. */
export function cleanAreaCounts(
  names: (string | undefined)[],
  cityName: string,
  knownLocalities: string[],
): AreaCount[] {
  const known = new Set(knownLocalities.map((l) => l.toLowerCase()));
  const counts = new Map<string, number>();
  for (const n of names) if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts]
    .filter(([name, count]) => isCleanArea(name, count, cityName, known))
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
