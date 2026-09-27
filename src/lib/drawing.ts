/**
 * Hilfsfunktionen für die technischen Zeichnungen (Hinweislinien, Maßketten, eindeutige IDs).
 */

/** Eindeutige ID-Präfixe, damit Schraffur-Muster mehrerer Zeichnungen auf einer Seite nicht kollidieren. */
export const drawingUid = (prefix = 'd') => `${prefix}${crypto.randomUUID().slice(0, 8)}`;

export interface Callout {
  /** Punkt am Bauteil */
  x: number;
  y: number;
  /** Höhe der Beschriftung */
  ly: number;
  text: string;
}

/** Hinweislinie vom Bauteil nach rechts zur Beschriftungsspalte (Knick bei edge + 8 … 16). */
export const leaderRight = (c: Callout, edge: number) => `M${c.x} ${c.y} H${edge + 8} L${edge + 16} ${c.ly} H${edge + 22}`;

/** Hinweislinie vom Bauteil nach links zur Beschriftungsspalte. */
export const leaderLeft = (c: Callout, edge: number) => `M${c.x} ${c.y} H${edge - 8} L${edge - 16} ${c.ly} H${edge - 22}`;

/** Architektonischer Maßstrich (45°) an einem Punkt. */
export const tick = (x: number, y: number, size = 3.5) => `M${x - size} ${y + size} L${x + size} ${y - size}`;
