export type NormalizedRegion = { x: number; y: number; width: number; height: number };
export type ImageRect = { x: number; y: number; width: number; height: number };
export type CalloutLayout = { id: string; side: 'left' | 'right'; anchorX: number; anchorY: number; cardX: number; cardY: number; cardWidth: number };

export function clampRegion(region: NormalizedRegion): NormalizedRegion {
  const x = Math.min(1, Math.max(0, region.x));
  const y = Math.min(1, Math.max(0, region.y));
  const width = Math.min(1 - x, Math.max(0, region.width));
  const height = Math.min(1 - y, Math.max(0, region.height));
  return { x, y, width, height };
}

export function mapNormalizedRegionToImage(region: NormalizedRegion, imageRect: ImageRect) {
  const safe = clampRegion(region);
  return { x: imageRect.x + safe.x * imageRect.width, y: imageRect.y + safe.y * imageRect.height, width: safe.width * imageRect.width, height: safe.height * imageRect.height };
}

export function calculateCalloutLayout(items: Array<{ id: string; anchor?: { x: number; y: number }; boundingBox?: NormalizedRegion; regions?: NormalizedRegion[] }>, container: { width: number; height: number }, imageRect: ImageRect, cardWidth = 132, cardHeight = 54): CalloutLayout[] {
  const placed = items.map((item) => {
    const region = item.boundingBox ?? item.regions?.[0];
    const anchor = item.anchor ?? (region ? { x: region.x + region.width / 2, y: region.y + region.height / 2 } : undefined);
    if (!anchor) return undefined;
    const anchorX = imageRect.x + Math.max(0, Math.min(1, anchor.x)) * imageRect.width;
    const anchorY = imageRect.y + Math.max(0, Math.min(1, anchor.y)) * imageRect.height;
    return { item, anchorX, anchorY, side: anchor.x < 0.5 ? 'right' as const : 'left' as const };
  }).filter(Boolean) as Array<{ item: (typeof items)[number]; anchorX: number; anchorY: number; side: 'left' | 'right' }>;
  const result: CalloutLayout[] = [];
  for (const side of ['left', 'right'] as const) {
    const sideItems = placed.filter((entry) => entry.side === side).sort((a, b) => a.anchorY - b.anchorY);
    let nextY = 8;
    for (const entry of sideItems) {
      const cardX = side === 'left' ? 8 : container.width - cardWidth - 8;
      const cardY = Math.min(Math.max(nextY, entry.anchorY - cardHeight / 2, 8), Math.max(8, container.height - cardHeight - 8));
      result.push({ id: entry.item.id, side, anchorX: entry.anchorX, anchorY: entry.anchorY, cardX, cardY, cardWidth });
      nextY = cardY + cardHeight + 8;
    }
  }
  return result;
}
// Converts normalized coordinates to device dimensions and calculates collision-aware callout placement.
