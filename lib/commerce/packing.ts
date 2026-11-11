import type { PricedLine } from "./cart";
import type { PackedUnit } from "./catalog";
import type { Box, CommerceRules } from "./rules";
// Packing strategy (deterministic, explainable):
// 1. Expand the cart into packed units (one bag each, with gross weight and
//    package size from the CMS; kits expand into their bags).
// 2. Sort units by volume, then weight, largest first.
// 3. First fit decreasing: put each unit in the first open volume where it
//    still fits; otherwise open a new volume. A volume "fits" when some box
//    holds every unit's largest dimensions, the sum of unit volumes stays
//    within the box's inner volume × fill factor, and units + tare stay
//    within the maximum weight per volume.
// 4. Each volume uses the smallest box (by inner volume) that fits it.
// Freight is quoted per volume; nothing is summed into one naive parcel.
export type Volume = {
  box: Pick<Box, "id" | "label">;
  heightCm: number;
  widthCm: number;
  lengthCm: number;
  weightGrams: number;
  insuranceCents: number;
  items: { sku: string; quantity: number }[];
};
export class PackingError extends Error {
  constructor(
    readonly code: "no_boxes" | "unit_too_large" | "unit_too_heavy",
    readonly sku: string | null = null,
  ) {
    super(code);
  }
}
type Unit = PackedUnit & { valueCents: number; dims: number[]; volume: number };
const sortedDims = (a: number, b: number, c: number) =>
  [a, b, c].sort((x, y) => y - x);
function unitsOf(lines: PricedLine[]): Unit[] {
  const units: Unit[] = [];
  for (const line of lines) {
    const count = line.item.packing.reduce((n, e) => n + e.quantity, 0);
    // The line value is spread over its bags, for per-volume insurance.
    const perBag = Math.floor(line.item.unitPriceCents / Math.max(count, 1));
    for (let i = 0; i < line.quantity; i++)
      for (const entry of line.item.packing)
        for (let j = 0; j < entry.quantity; j++) {
          const u = entry.unit;
          units.push({
            ...u,
            valueCents: perBag,
            dims: sortedDims(u.heightCm, u.widthCm, u.lengthCm),
            volume: u.heightCm * u.widthCm * u.lengthCm,
          });
        }
  }
  return units.sort(
    (a, b) =>
      b.volume - a.volume ||
      b.grossGrams - a.grossGrams ||
      a.sku.localeCompare(b.sku),
  );
}
const innerVolume = (box: Box) =>
  box.innerHeightCm * box.innerWidthCm * box.innerLengthCm;
function fits(
  box: Box,
  units: Unit[],
  rules: Pick<CommerceRules, "maxVolumeWeightGrams" | "packingFillFactor">,
) {
  const inner = sortedDims(
    box.innerHeightCm,
    box.innerWidthCm,
    box.innerLengthCm,
  );
  const weight = units.reduce((n, u) => n + u.grossGrams, box.tareGrams);
  const volume = units.reduce((n, u) => n + u.volume, 0);
  return (
    weight <= rules.maxVolumeWeightGrams &&
    volume <= innerVolume(box) * rules.packingFillFactor &&
    units.every((u) => u.dims.every((d, i) => d <= inner[i]))
  );
}
export function packCart(
  lines: PricedLine[],
  rules: Pick<
    CommerceRules,
    "boxes" | "maxVolumeWeightGrams" | "packingFillFactor"
  >,
): Volume[] {
  if (!rules.boxes.length) throw new PackingError("no_boxes");
  const boxes = [...rules.boxes].sort(
    (a, b) => innerVolume(a) - innerVolume(b) || a.id.localeCompare(b.id),
  );
  const smallest = (units: Unit[]) =>
    boxes.find((box) => fits(box, units, rules));
  const open: Unit[][] = [];
  for (const unit of unitsOf(lines)) {
    const target = open.find((units) => smallest([...units, unit]));
    if (target) {
      target.push(unit);
      continue;
    }
    if (!smallest([unit])) {
      const heavy = boxes.some(
        (box) => box.tareGrams + unit.grossGrams > rules.maxVolumeWeightGrams,
      );
      throw new PackingError(
        heavy ? "unit_too_heavy" : "unit_too_large",
        unit.sku,
      );
    }
    open.push([unit]);
  }
  return open.map((units) => {
    const box = smallest(units) as Box;
    const items = new Map<string, number>();
    for (const u of units) items.set(u.sku, (items.get(u.sku) ?? 0) + 1);
    return {
      box: { id: box.id, label: box.label },
      heightCm: box.outerHeightCm,
      widthCm: box.outerWidthCm,
      lengthCm: box.outerLengthCm,
      weightGrams: units.reduce((n, u) => n + u.grossGrams, box.tareGrams),
      insuranceCents: units.reduce((n, u) => n + u.valueCents, 0),
      items: [...items]
        .map(([sku, quantity]) => ({ sku, quantity }))
        .sort((a, b) => a.sku.localeCompare(b.sku)),
    };
  });
}
