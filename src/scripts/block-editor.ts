/**
 * Element-Editor im Bearbeiten-Modus (gestartet von src/components/debug/EditMode.astro).
 *
 *  · „+ Element hier einfügen“ zwischen den Abschnitten jeder Seite und in jedem Container
 *    → Auswahl aus Vorlagen, Basis-Elementen und Containern mit echter Vorschau (src/components/debug/BlockEditorUI.astro)
 *  · „Elemente“ in der Leiste: Seitenleiste mit allen Elementen – per Drag & Drop an (fast) jede Stelle der Seite ziehen,
 *    oder antippen und danach die Stelle anklicken (Handy: Stelle antippen, dann „Hier einfügen“)
 *  · Texte direkt anklicken und ändern, Bilder/Symbole anklicken zum Austauschen
 *  · Element anklicken → Werkzeugleiste: übergeordnetes wählen, hoch/runter, danach einfügen, duplizieren,
 *    verschieben (ziehen oder klicken – auch in andere Container und zwischen beliebige Seitenteile), Einstellungen, löschen
 *
 * Stellen auf der Seite: zwischen den Abschnitten (Zone „3“) oder vor/hinter einem beliebigen Element („@3.2.1|after“,
 * siehe src/lib/blocks/schema.ts). Gezählt wird wie beim Build – zur Laufzeit eingefügte Elemente zählen nicht mit.
 *  · Speichern über den gemeinsamen Knopf → POST /api/edit/bausteine/ → src/content/blocks.json
 *
 * Die Vorschau entsteht mit demselben Renderer wie beim Build (src/lib/blocks/render.ts).
 */
import { PRESETS } from '@/lib/blocks/presets';
import { renderZone, type RenderContext } from '@/lib/blocks/render';
import { BLOCK_DESIGN, STYLE_OPTIONS, blocksCss } from '@/lib/blocks/style';
import { designToggle, subsection } from '@/scripts/editor/panel';
import {
  type Block,
  type BlockStyle,
  type BlockType,
  type Field,
  type PageBlocks,
  BLOCK_ICONS,
  ZONE_KEY,
  blockDef,
  clampZones,
  createBlock,
  isValidLink,
  newId,
  parseAnchor,
  sanitizePage,
  sanitizeStyle,
} from '@/lib/blocks/schema';

type EditorImage = { name: string; thumb: string; src: string; width: number; height: number };
type EditorData = { images: EditorImage[]; icons: Record<string, string> };
type Location = { list: Block[]; index: number; block: Block; parent: Block | null; zone: string };
/** Ziel beim Einfügen/Verschieben: Liste („zone:3“, „zone:@3.2|after“ oder „<blockId>:<slot>“), Position darin, Markierung */
type Drop = { target: string; index?: number; el: Element; axis: 'x' | 'y' | 'box'; side: 'before' | 'after' | 'inside' };
/** Was gerade platziert wird: neues Element aus der Auswahl oder ein vorhandenes */
type Placing = { choice: string; label: string } | { id: string; label: string };

/** In diese Elemente wird nichts eingefügt – der Browser würde das HTML sonst umbauen (Text, Links, Tabellen …) */
export const CLOSED = 'p, h1, h2, h3, h4, h5, h6, a, button, label, summary, table, select, picture, svg, dl, figcaption, blockquote, address, pre';
/** Elemente ohne Inhalt – nur davor/dahinter einfügbar */
const VOID = 'img, input, br, hr, video, iframe, textarea, source, canvas';
/** Zur Laufzeit eingefügt – zählt für die Stellen nicht mit (gleiche Zählweise wie beim Build) */
export const RUNTIME = '[data-ub-ignore], [data-gallery-edit], [data-hero-edit-btn]';

/** Einfügestelle: Liste („zone:3“, „zone:@3.2|after“ oder „<blockId>:<slot>“) und Position darin */
export type InsertTarget = { target: string; index?: number; label: string };
export type InsertPosition = 'before' | 'after' | 'start' | 'end';

export interface BlockEditorHooks {
  /** Änderungen an Elementen – Seitenleiste aktualisieren */
  onChange(): void;
  /** Bild vor dem Hochladen verkleinern → Base64 (JPEG) */
  shrink(file: File): Promise<string>;
  /** Statusmeldung in der Seitenleiste */
  status(message: string): void;
  /** Element nach Einfügen/Verschieben auswählen */
  select(id: string): void;
  /** „+“ auf der Seite angeklickt → Einfügen-Bereich der Seitenleiste mit diesem Ziel öffnen */
  openInsert(target: InsertTarget): void;
  /** Gewählte Einfügestelle aus der Seitenleiste abholen (und zurücksetzen) – null: Stelle auf der Seite wählen */
  takeTarget(): InsertTarget | null;
  /** Platzieren gestartet/beendet (Hinweis in der Seitenleiste) */
  placing(label: string | null, moving: boolean): void;
}

const SITE_LINKS = ['/', '/leistungen/', '/stellenangebote/', '/betrieb/', '/kontakt/', '/stellenangebote/initiativ/', '/impressum/', '/datenschutz/'];

export function createBlockEditor(ui: HTMLElement, hooks: BlockEditorHooks) {
  const main = document.querySelector<HTMLElement>('main');
  const library = ui.querySelector<HTMLElement>('[data-ub-library]')!;
  const dropMarker = ui.querySelector<HTMLElement>('[data-ub-drop]')!;
  const dropLabel = dropMarker.querySelector<HTMLElement>('[data-ub-drop-label]')!;
  const dropOk = dropMarker.querySelector<HTMLButtonElement>('[data-ub-drop-ok]')!;
  const ghost = ui.querySelector<HTMLElement>('[data-ub-ghost]')!;
  const picker = ui.querySelector<HTMLDialogElement>('[data-ub-picker]')!;
  const pickerGrid = picker.querySelector<HTMLOListElement>('[data-ub-picker-grid]')!;
  const pickerTitle = picker.querySelector<HTMLElement>('[data-ub-picker-title]')!;
  const pickerStatus = picker.querySelector<HTMLElement>('[data-ub-picker-status]')!;
  const pickerDone = picker.querySelector<HTMLButtonElement>('[data-ub-picker-done]')!;
  const pickerUpload = picker.querySelector<HTMLInputElement>('[data-ub-picker-upload]')!;

  let state: PageBlocks = {};
  let saved = '{}';
  let data: EditorData = { images: [], icons: {} };
  let imageMap = new Map<string, EditorImage>();
  /** Neu hochgeladene Bilder – bis zum nächsten Build nur als Vorschau im Browser */
  const localImages = new Map<string, string>();
  let active = false;
  let ready = false;
  let session = 0;
  let placing: Placing | null = null;
  /** Handy: angetippte Stelle, wartet auf „Hier einfügen“ */
  let pendingDrop: Drop | null = null;
  /** Für welches Element und in welchem Behälter die Einstellungen gerade aufgebaut sind */
  let panelFor: string | null = null;
  let panelFields: HTMLElement | null = null;

  const ctx: RenderContext = {
    editing: true,
    image: (name) => {
      const local = localImages.get(name);
      if (local) return { src: local };
      const image = imageMap.get(name);
      return image ? { src: image.src, width: image.width, height: image.height } : undefined;
    },
    icon: (name) => data.icons[name] ?? '',
  };

  // Gestaltung der Elemente live als CSSOM-Stylesheet (erlaubt trotz Content-Security-Policy);
  // das beim Build erzeugte <style data-ub-style> wird dafür im Bearbeiten-Modus abgeschaltet
  const sheet = new CSSStyleSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  const updateCss = () => sheet.replaceSync(Object.values(state).map((blocks) => blocksCss(blocks, ctx.image)).join(''));

  /* ---------------- Zonen auf der Seite ---------------- */
  const counted = (el: Element) => el.tagName !== 'UB-ZONE' && !el.matches(RUNTIME);
  const kids = (el: Element) => [...el.children].filter(counted);
  const sections = () => (main ? kids(main) : []);
  const zoneEl = (key: string) => main?.querySelector<HTMLElement>(`ub-zone[data-ub-zone="${CSS.escape(key)}"]`) ?? null;

  /** Position eines Elements ab <main>, z. B. [3, 2, 1] – null, wenn es nicht mitgezählt wird */
  const pathOf = (el: Element): number[] | null => {
    const path: number[] = [];
    for (let node = el; node !== main; ) {
      const parent = node.parentElement;
      if (!parent || !counted(node)) return null;
      path.unshift(kids(parent).indexOf(node) + 1);
      node = parent;
    }
    return path;
  };

  const elementAt = (path: number[]) => {
    let node: Element | undefined = main ?? undefined;
    for (const index of path) node = node && kids(node)[index - 1];
    return node ?? null;
  };

  const createZone = (key: string) => {
    const zone = document.createElement('ub-zone');
    zone.dataset.ubZone = key;
    return zone;
  };

  /** Nach jedem Abschnitt eine (ggf. leere) Zone bereitstellen – dazu die Zonen an einzelnen Elementen */
  const ensureZones = () => {
    if (!main) return;
    sections().forEach((section, i) => {
      const key = String(i + 1);
      if (!zoneEl(key)) section.after(createZone(key));
    });
    for (const key of Object.keys(state)) {
      const anchor = parseAnchor(key);
      if (!anchor || zoneEl(key)) continue;
      const zone = createZone(key);
      const el = elementAt(anchor.path);
      // Element gibt es nicht (mehr) → ans Ende der Seite, wie beim Build
      if (!el) main.append(zone);
      else if (anchor.position === 'before') el.before(zone);
      else if (anchor.position === 'after') el.after(zone);
      else if (anchor.position === 'start') el.prepend(zone);
      else el.append(zone);
    }
  };

  const render = () => {
    if (!main) return;
    const editing = active && ready;
    for (const key of Object.keys(state)) if (!state[key].length) delete state[key];
    if (editing) ensureZones();
    main.querySelectorAll<HTMLElement>('ub-zone').forEach((zone) => {
      const key = zone.dataset.ubZone ?? '';
      const blocks = state[key] ?? [];
      // Leere Zonen an einzelnen Elementen braucht es nicht – dort wird per Ziehen/Anklicken eingefügt
      if (!blocks.length && (!editing || key.startsWith('@'))) {
        zone.remove();
        return;
      }
      zone.innerHTML = renderZone(blocks, { ...ctx, editing }, key);
    });
    updateCss();
    if (!editing) return;
    // Texte werden in der Seitenleiste geändert – auf der Seite nur anzeigen
    if (placing) markMoveTargets();
    if (pendingDrop) showDrop(pendingDrop, true);
  };

  /* ---------------- Baum-Hilfen ---------------- */
  function find(id: string): Location | null {
    const walk = (list: Block[], parent: Block | null, zone: string): Location | null => {
      for (let index = 0; index < list.length; index++) {
        const block = list[index];
        if (block.id === id) return { list, index, block, parent, zone };
        for (const slot of block.slots ?? []) {
          const hit = walk(slot, block, zone);
          if (hit) return hit;
        }
      }
      return null;
    };
    for (const [zone, list] of Object.entries(state)) {
      const hit = walk(list, null, zone);
      if (hit) return hit;
    }
    return null;
  }

  /** Ziel „zone:3“ oder „<blockId>:<slot>“ → Liste, in die eingefügt wird */
  const listFor = (target: string): Block[] | null => {
    const [owner, index] = target.split(':');
    if (owner === 'zone') return (state[index] ??= []);
    return find(owner)?.block.slots?.[Number(index)] ?? null;
  };

  /** Ziel der Liste, in der ein Element steht */
  const targetOf = (loc: Location) =>
    loc.parent ? `${loc.parent.id}:${loc.parent.slots!.findIndex((slot) => slot === loc.list)}` : `zone:${loc.zone}`;

  const contains = (block: Block, id: string): boolean =>
    block.id === id || (block.slots ?? []).some((slot) => slot.some((child) => contains(child, id)));

  const cloneWithNewIds = (block: Block): Block => ({
    ...structuredClone(block),
    id: newId(),
    slots: block.slots?.map((slot) => slot.map(cloneWithNewIds)),
  });

  const changed = () => {
    render();
    hooks.onChange();
  };

  const blockEl = (id: string) => main?.querySelector<HTMLElement>(`[data-ub="${id}"]`) ?? null;

  /* ---------------- Aktionen (aus der Seitenleiste) ---------------- */
  /** Hoch/runter möglich? Zwischen den Abschnitten auch in die Nachbar-Zone */
  const canMove = (loc: Location, step: -1 | 1) => {
    const to = loc.index + step;
    if (to >= 0 && to < loc.list.length) return true;
    if (loc.parent || !/^\d+$/.test(loc.zone)) return false;
    const next = Number(loc.zone) + step;
    return next >= 1 && next <= sections().length;
  };

  const moveBy = (id: string, step: -1 | 1) => {
    const loc = find(id);
    if (!loc || !canMove(loc, step)) return;
    const to = loc.index + step;
    if (to >= 0 && to < loc.list.length) {
      loc.list.splice(loc.index, 1);
      loc.list.splice(to, 0, loc.block);
    } else {
      // Oberste Ebene: in die Zone vor bzw. nach dem benachbarten Abschnitt wechseln
      loc.list.splice(loc.index, 1);
      const list = (state[String(Number(loc.zone) + step)] ??= []);
      if (step < 0) list.push(loc.block);
      else list.unshift(loc.block);
    }
    changed();
    hooks.select(id);
    blockEl(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  /** Löschen – liefert das übergeordnete Element (zum Weiter-Auswählen) */
  const remove = (id: string): string | null => {
    const loc = find(id);
    if (!loc) return null;
    const hasChildren = loc.block.slots?.some((slot) => slot.length);
    if (hasChildren && !confirm(`„${blockDef(loc.block.type)?.label}“ mit allen enthaltenen Elementen löschen?`)) return id;
    loc.list.splice(loc.index, 1);
    changed();
    return loc.parent?.id ?? null;
  };

  const duplicate = (id: string) => {
    const loc = find(id);
    if (!loc) return;
    const copy = cloneWithNewIds(loc.block);
    loc.list.splice(loc.index + 1, 0, copy);
    changed();
    hooks.select(copy.id);
  };

  const build = (choice: string) => {
    const [kind, name] = choice.split(':');
    return kind === 'preset' ? PRESETS.find((preset) => preset.id === name)?.build() : blockDef(name) ? createBlock(name as BlockType) : undefined;
  };

  const insertAt = (choice: string, target: string, index: number | undefined, scroll: ScrollLogicalPosition) => {
    const block = build(choice);
    const list = listFor(target);
    if (!block || !list) return;
    list.splice(index ?? list.length, 0, block);
    changed();
    hooks.select(block.id);
    requestAnimationFrame(() => blockEl(block.id)?.scrollIntoView({ block: scroll, behavior: 'smooth' }));
    // Neues Bild-Element: gleich die Bildauswahl öffnen
    if (block.type === 'image' || block.type === 'gallery') openPickerFor(block);
  };

  /** Beschriftung einer Einfügestelle für die Seitenleiste */
  const describeTarget = (target: string) => {
    const [owner, slot] = target.split(':');
    if (owner !== 'zone') {
      const parent = find(owner)?.block;
      const def = parent ? blockDef(parent.type) : null;
      const slots = parent?.slots?.length ?? 0;
      return `in „${def?.label ?? 'Element'}“${slots > 1 ? ` (Bereich ${Number(slot) + 1})` : ''}`;
    }
    return 'an dieser Stelle der Seite';
  };

  /**
   * Einfügestelle relativ zu einem Element der Seite (Seitenleiste: davor, dahinter, innen oben/unten).
   * null = dort kann nichts eingefügt werden (z. B. in Texte, Links, Kopf- und Fußzeile).
   */
  const targetFor = (el: Element, position: InsertPosition): InsertTarget | null => {
    if (!main || !main.contains(el) || el === main) return null;
    const node = el.closest<HTMLElement>('[data-ub]');
    if (node && node === el) {
      const loc = find(node.dataset.ub!);
      if (!loc) return null;
      const label = blockDef(loc.block.type)?.label ?? 'Element';
      if (position === 'before' || position === 'after') {
        return { target: targetOf(loc), index: loc.index + (position === 'after' ? 1 : 0), label: `${position === 'before' ? 'vor' : 'nach'} „${label}“` };
      }
      const slots = loc.block.slots ?? [];
      if (!slots.length) return null;
      const slot = position === 'start' ? 0 : slots.length - 1;
      return { target: `${loc.block.id}:${slot}`, index: position === 'start' ? 0 : undefined, label: `${position === 'start' ? 'oben' : 'unten'} in „${label}“` };
    }
    if (el.closest('ub-zone')) return null;
    const path = pathOf(el);
    if (!path) return null;
    const parent = el.parentElement;
    const inside = position === 'start' || position === 'end';
    if (inside && (el.matches(CLOSED) || el.matches(VOID) || el.closest(CLOSED))) return null;
    if (!inside && parent !== main && parent?.closest(CLOSED)) return null;
    const words = { before: 'davor', after: 'dahinter', start: 'innen oben', end: 'innen unten' };
    // Zwischen den Abschnitten: die Zonen „n“ (gleiche Stellen wie die „+“-Felder)
    if (path.length === 1 && !inside) {
      const n = path[0];
      if (position === 'after') return { target: `zone:${n}`, index: 0, label: words.after };
      return n > 1 ? { target: `zone:${n - 1}`, label: words.before } : { target: 'zone:@1|before', label: words.before };
    }
    const key = `@${path.join('.')}|${position}`;
    if (!ZONE_KEY.test(key)) return null;
    // Jeweils möglichst nah am gewählten Element: dahinter/innen oben an den Anfang, davor/innen unten ans Ende
    return { target: `zone:${key}`, index: position === 'after' || position === 'start' ? 0 : undefined, label: words[position] };
  };

  /* ---------------- Einfügen & Verschieben an beliebiger Stelle ---------------- */
  const movingId = () => (placing && 'id' in placing ? placing.id : null);

  /** Ein Element darf nicht in sich selbst verschoben werden */
  const allowed = (target: string, id = movingId()) => {
    const [owner] = target.split(':');
    const block = id ? find(id)?.block : null;
    return owner === 'zone' || !block || !contains(block, owner);
  };

  const markMoveTargets = () => {
    main?.querySelectorAll<HTMLElement>('.ub-add').forEach((button) => {
      button.toggleAttribute('data-ub-invalid', !allowed(button.dataset.ubAdd ?? ''));
      const label = button.querySelector('span');
      if (label) label.textContent = movingId() ? 'Hierher' : 'Hier einfügen';
    });
  };

  const isBlockLevel = (el: Element) => {
    if (!(el instanceof HTMLElement)) return false;
    const style = getComputedStyle(el);
    return !style.display.startsWith('inline') && style.display !== 'contents' && style.position !== 'absolute' && style.position !== 'fixed';
  };

  /** Nächstes Element um die Trefferstelle, vor/hinter dem ein Element stehen kann */
  const anchorFor = (hit: Element): Element | null => {
    let el: Element | null = hit.closest('svg') ?? hit;
    while (el && el !== main) {
      const parent: Element | null = el.parentElement;
      if (!parent) return null;
      if (counted(el) && (parent === main || (!parent.closest(CLOSED) && isBlockLevel(el)))) return el;
      el = parent;
    }
    return null;
  };

  /** Stehen Nachbarn daneben (Raster, Spalten), wird links/rechts eingefügt – sonst oben/unten */
  const axisOf = (el: Element): 'x' | 'y' => {
    const r = el.getBoundingClientRect();
    const siblings = [...(el.parentElement?.children ?? [])];
    const beside = siblings.some((sibling) => {
      if (sibling === el || sibling.tagName === 'UB-ZONE') return false;
      const q = sibling.getBoundingClientRect();
      return q.width > 0 && q.height > 0 && q.top < r.bottom - 4 && q.bottom > r.top + 4 && (q.right <= r.left + 4 || q.left >= r.right - 4);
    });
    return beside ? 'x' : 'y';
  };

  const sideOf = (el: Element, axis: 'x' | 'y', x: number, y: number) => {
    const r = el.getBoundingClientRect();
    return (axis === 'x' ? x < r.left + r.width / 2 : y < r.top + r.height / 2) ? 'before' : 'after';
  };

  const dropForAdd = (add: HTMLElement): Drop | null =>
    allowed(add.dataset.ubAdd!) ? { target: add.dataset.ubAdd!, el: add, axis: 'box', side: 'inside' } : null;

  /** Ziel an einer Bildschirmstelle: „+“-Feld, vor/hinter einem Element aus dem Baukasten oder einem beliebigen Seitenelement */
  const dropAt = (x: number, y: number): Drop | null => {
    const hit = document.elementFromPoint(x, y);
    if (!main || !hit || !main.contains(hit)) return null;
    const add = hit.closest<HTMLElement>('[data-ub-add]');
    if (add) return dropForAdd(add);

    let node = hit.closest<HTMLElement>('[data-ub]');
    const id = movingId();
    const own = id ? blockEl(id) : null;
    if (node && own?.contains(node)) node = own;
    if (node) {
      const loc = find(node.dataset.ub!);
      if (!loc || !allowed(targetOf(loc))) return null;
      const axis = axisOf(node);
      const side = sideOf(node, axis, x, y);
      return { target: targetOf(loc), index: loc.index + (side === 'after' ? 1 : 0), el: node, axis, side };
    }
    if (hit.closest('ub-zone')) return null;

    const anchor = anchorFor(hit);
    const path = anchor && pathOf(anchor);
    if (!anchor || !path) return null;
    const axis = path.length === 1 ? 'y' : axisOf(anchor);
    const side = sideOf(anchor, axis, x, y);
    // Zwischen den Abschnitten: die Zonen „n“ (davor = Ende der Zone davor, dahinter = Anfang der Zone danach)
    if (path.length === 1) {
      const n = path[0];
      if (side === 'after') return { target: `zone:${n}`, index: 0, el: anchor, axis, side };
      return { target: n > 1 ? `zone:${n - 1}` : 'zone:@1|before', el: anchor, axis, side };
    }
    const key = `@${path.join('.')}|${side}`;
    if (!ZONE_KEY.test(key)) return null;
    return { target: `zone:${key}`, index: side === 'after' ? 0 : undefined, el: anchor, axis, side };
  };

  /** Gelbe Linie (bzw. Rahmen) an der Stelle, an der eingefügt wird */
  function showDrop(drop: Drop | null, confirm = false) {
    if (!drop || !drop.el.isConnected) {
      dropMarker.hidden = true;
      return;
    }
    const r = drop.el.getBoundingClientRect();
    const viewWidth = document.documentElement.clientWidth;
    let { left, top, width, height } = r;
    if (drop.axis === 'y') {
      top = (drop.side === 'before' ? r.top : r.bottom) - 2;
      height = 4;
    } else if (drop.axis === 'x') {
      left = (drop.side === 'before' ? r.left : r.right) - 2;
      width = 4;
    }
    left = Math.max(4, left);
    width = Math.max(4, Math.min(width, viewWidth - 4 - left));
    dropMarker.dataset.axis = drop.axis;
    dropMarker.toggleAttribute('data-flip', top < 90);
    dropMarker.style.setProperty('transform', `translate(${Math.round(left)}px, ${Math.round(top)}px)`);
    dropMarker.style.setProperty('width', `${Math.round(width)}px`);
    dropMarker.style.setProperty('height', `${Math.round(height)}px`);
    const moving = Boolean(movingId() || (drag && 'id' in drag.item));
    dropLabel.textContent = moving ? 'Hierher verschieben' : 'Hier einfügen';
    dropLabel.hidden = confirm;
    dropOk.hidden = !confirm;
    dropOk.textContent = moving ? 'Hierher verschieben' : 'Hier einfügen';
    dropMarker.hidden = false;
  }

  const moveTo = (id: string, target: string, index?: number) => {
    const loc = find(id);
    const list = loc && allowed(target, id) ? listFor(target) : null;
    if (!loc || !list) return;
    let at = index ?? list.length;
    if (list === loc.list && at > loc.index) at--;
    loc.list.splice(loc.index, 1);
    list.splice(at, 0, loc.block);
    changed();
    hooks.select(id);
  };

  const place = (item: Placing, drop: Drop) => {
    if ('id' in item) moveTo(item.id, drop.target, drop.index);
    else insertAt(item.choice, drop.target, drop.index, 'nearest');
  };

  const setPlacing = (item: Placing | null) => {
    placing = item;
    pendingDrop = null;
    showDrop(null);
    document.documentElement.classList.toggle('ub-moving', Boolean(item));
    hooks.placing(item?.label ?? null, Boolean(item && 'id' in item));
    render();
  };

  /* ---------------- Ziehen (Maus/Stift) ---------------- */
  let drag: { item: Placing; x: number; y: number; started: boolean } | null = null;
  let point = { x: 0, y: 0 };
  let currentDrop: Drop | null = null;
  let suppressClick = false;
  let scrollFrame = 0;
  let lastPointer = 'mouse';

  const beginDrag = (event: PointerEvent, item: Placing) => {
    if (event.button !== 0 || event.pointerType === 'touch') return;
    drag = { item, x: event.clientX, y: event.clientY, started: false };
  };

  const track = (x: number, y: number) => {
    point = { x, y };
    if (drag?.started) ghost.style.setProperty('transform', `translate(${Math.round(x + 14)}px, ${Math.round(y + 16)}px)`);
    currentDrop = dropAt(x, y);
    showDrop(currentDrop);
  };

  /** Am oberen/unteren Rand beim Ziehen mitscrollen */
  const autoScroll = () => {
    if (!drag?.started) return;
    const edge = 80;
    const top = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    const { y } = point;
    const speed = y < top + edge ? -Math.min(24, Math.ceil((top + edge - y) / 4)) : y > innerHeight - edge ? Math.min(24, Math.ceil((y - innerHeight + edge) / 4)) : 0;
    if (speed) {
      window.scrollBy({ top: speed, behavior: 'instant' });
      track(point.x, point.y);
    }
    scrollFrame = requestAnimationFrame(autoScroll);
  };

  const endDrag = () => {
    drag = null;
    cancelAnimationFrame(scrollFrame);
    document.documentElement.classList.remove('ub-dragging');
    ghost.hidden = true;
    if (!placing) showDrop(null);
    currentDrop = null;
  };

  window.addEventListener(
    'pointerdown',
    (event) => {
      lastPointer = event.pointerType;
    },
    true,
  );

  window.addEventListener('pointermove', (event) => {
    if (!active) return;
    if (drag) {
      if (!drag.started) {
        if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
        drag.started = true;
        document.documentElement.classList.add('ub-dragging');
        getSelection()?.removeAllRanges();
        ghost.textContent = drag.item.label;
        ghost.hidden = false;
        scrollFrame = requestAnimationFrame(autoScroll);
      }
      track(event.clientX, event.clientY);
      return;
    }
    if (placing && !pendingDrop && event.pointerType === 'mouse') track(event.clientX, event.clientY);
  });

  window.addEventListener('pointerup', () => {
    if (!drag) return;
    const { item, started } = drag;
    const drop = currentDrop;
    if (!started) {
      drag = null;
      return;
    }
    // Der Klick nach dem Loslassen soll nichts anderes auslösen
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    endDrag();
    if (placing) setPlacing(null);
    if (drop) place(item, drop);
  });

  window.addEventListener('pointercancel', () => drag && endDrag());

  // Platzieren per Klick: Maus fügt sofort ein, auf dem Handy erst nach „Hier einfügen“
  document.addEventListener(
    'click',
    (event) => {
      if (suppressClick) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (!active || !placing) return;
      const target = event.target as HTMLElement;
      if (target.closest('[data-ub-drop-ok]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const item = placing;
        const drop = pendingDrop;
        setPlacing(null);
        if (drop) place(item, drop);
        return;
      }
      if (!main?.contains(target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const add = target.closest<HTMLElement>('[data-ub-add]');
      const drop = add ? dropForAdd(add) : dropAt(event.clientX, event.clientY);
      if (!drop) return;
      if (lastPointer === 'mouse' || (add && event.detail === 0)) {
        const item = placing;
        setPlacing(null);
        place(item, drop);
        return;
      }
      pendingDrop = drop;
      showDrop(drop, true);
    },
    true,
  );

  /* ---------------- Einstellungen ---------------- */
  const thumbFor = (name: string) => localImages.get(name) ?? imageMap.get(name)?.thumb ?? '';

  const setProp = (block: Block, key: string, value: unknown, rerender = true) => {
    block.props[key] = value;
    const def = blockDef(block.type);
    const count = def?.slots?.(block.props) ?? 0;
    if (count && block.slots && block.slots.length !== count) {
      // Weniger Spalten: Inhalt der wegfallenden Spalten in die letzte verbleibende übernehmen
      const removed = block.slots.splice(count).flat();
      while (block.slots.length < count) block.slots.push([]);
      block.slots[count - 1].push(...removed);
    }
    if (rerender) changed();
    else hooks.onChange();
    // Felder mit Vorschau (Bild, Galerie, Symbol) in der Seitenleiste neu aufbauen
    const kind = def?.fields.find((f) => f.key === key)?.kind;
    if (panelFor === block.id && (kind === 'image' || kind === 'images' || kind === 'icon')) buildPanel(block);
  };

  function buildPanel(block: Block) {
    const def = blockDef(block.type);
    if (!def || !panelFields) return;
    panelFor = block.id;
    // Felder, die das Design steuern (Farbwelt, Aussehen), stehen unter „Design“
    const designKey = BLOCK_DESIGN[block.type].key;
    const content = def.fields.filter((field) => field.key !== designKey);
    panelFields.replaceChildren(
      ...(content.length ? [subsection('Inhalt', ...content.map((field) => fieldControl(block, field)))] : []),
      ...styleGroups(block),
    );
  }

  function fieldControl(block: Block, field: Field): HTMLElement {
    const wrap = document.createElement(field.kind === 'toggle' ? 'label' : 'div');
    wrap.className = `ub-f ub-f--${field.kind}`;
    wrap.dataset.ubKey = field.key;
    const value = block.props[field.key];
    const title = document.createElement('span');
    title.textContent = field.label;

    switch (field.kind) {
      case 'text':
      case 'link':
      case 'textarea': {
        const label = document.createElement('label');
        label.className = 'ub-f';
        label.dataset.ubKey = field.key;
        const input = field.kind === 'textarea' ? document.createElement('textarea') : document.createElement('input');
        if (input instanceof HTMLInputElement) input.type = 'text';
        input.value = String(value ?? '');
        label.append(title, input);
        const hint = document.createElement('small');
        if ('hint' in field && field.hint) hint.textContent = field.hint;
        if (field.kind === 'link') {
          const list = document.createElement('datalist');
          list.id = `ub-links-${block.id}`;
          list.append(...SITE_LINKS.map((href) => Object.assign(document.createElement('option'), { value: href })));
          input.setAttribute('list', list.id);
          label.append(list);
        }
        label.append(hint);
        input.addEventListener('input', () => {
          if (field.kind === 'link') {
            const ok = isValidLink(input.value.trim());
            hint.className = ok ? '' : 'ub-f__invalid';
            hint.textContent = ok ? ('hint' in field && field.hint) || '' : 'Ungültiger Link – bitte mit /, https://, tel: oder mailto: beginnen.';
            if (!ok) return;
            return setProp(block, field.key, input.value.trim());
          }
          setProp(block, field.key, input.value);
        });
        return label;
      }
      case 'select': {
        const select = document.createElement('select');
        select.append(
          ...field.options.map(([v, text]) => Object.assign(document.createElement('option'), { value: v, textContent: text, selected: v === value })),
        );
        select.addEventListener('change', () => setProp(block, field.key, select.value));
        const label = document.createElement('label');
        label.className = 'ub-f';
        label.dataset.ubKey = field.key;
        label.append(title, select);
        return label;
      }
      case 'toggle': {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = value === true;
        input.addEventListener('change', () => setProp(block, field.key, input.checked));
        wrap.append(input, title);
        return wrap;
      }
      case 'lines': {
        const label = document.createElement('label');
        label.className = 'ub-f';
        label.dataset.ubKey = field.key;
        const input = document.createElement('textarea');
        input.value = (Array.isArray(value) ? value : []).join('\n');
        const hint = document.createElement('small');
        hint.textContent = field.hint ?? '';
        input.addEventListener('input', () => setProp(block, field.key, input.value.split('\n')));
        label.append(title, input, hint);
        return label;
      }
      case 'image': {
        const row = document.createElement('div');
        row.className = 'ub-f__image';
        const thumb = document.createElement('span');
        thumb.className = 'ub-f__thumb';
        const src = thumbFor(String(value ?? ''));
        if (src) thumb.append(Object.assign(document.createElement('img'), { src, alt: '' }));
        const buttons = document.createElement('span');
        buttons.className = 'ub-f__buttons';
        buttons.append(
          button(value ? 'Anderes Bild' : 'Bild wählen', () => openPickerFor(block, field.key)),
          ...(value ? [button('Entfernen', () => setProp(block, field.key, ''))] : []),
        );
        row.append(thumb, buttons);
        wrap.append(title, row);
        return wrap;
      }
      case 'images': {
        const names = Array.isArray(value) ? value.map(String) : [];
        const list = document.createElement('ol');
        list.className = 'ub-f__list';
        names.forEach((name, i) => {
          const li = document.createElement('li');
          const src = thumbFor(name);
          if (src) li.append(Object.assign(document.createElement('img'), { src, alt: name }));
          const tools = document.createElement('span');
          const shift = (to: number) => () => {
            if (to < 0 || to >= names.length) return;
            const next = [...names];
            next.splice(to, 0, ...next.splice(i, 1));
            setProp(block, field.key, next);
          };
          tools.append(
            button('←', shift(i - 1), 'Nach vorne'),
            button('✕', () => setProp(block, field.key, names.filter((_, j) => j !== i)), 'Entfernen'),
            button('→', shift(i + 1), 'Nach hinten'),
          );
          li.append(tools);
          list.append(li);
        });
        const add = button(names.length ? 'Bilder auswählen' : 'Bilder wählen', () => openPickerFor(block));
        add.className = 'ub-f__mini';
        wrap.append(title, list, add);
        return wrap;
      }
      case 'color':
        return colorRow(field.label, String(value ?? ''), (color) => setProp(block, field.key, color ?? ''));
      case 'number':
        return numberRow(field.label, value as number | undefined, field.unit ?? '', field.min, field.max, (number) =>
          setProp(block, field.key, number ?? blockDef(block.type)?.defaults[field.key]),
        );
      case 'icon': {
        const grid = document.createElement('div');
        grid.className = 'ub-f__icons';
        for (const name of BLOCK_ICONS) {
          const b = button('', () => setProp(block, field.key, name), name);
          b.innerHTML = data.icons[name] ?? name;
          b.setAttribute('aria-pressed', String(value === name));
          grid.append(b);
        }
        wrap.append(title, grid);
        return wrap;
      }
    }
  }

  /* ---------------- Gestaltung (für jedes Element) ---------------- */
  const setStyle = (block: Block, patch: Partial<BlockStyle>) => {
    const style = sanitizeStyle({ ...block.style, ...patch });
    if (style) block.style = style;
    else delete block.style;
    changed();
  };

  const row = (title: string, ...children: (HTMLElement | string)[]) => {
    const wrap = document.createElement('div');
    wrap.className = 'ub-f';
    const label = document.createElement('span');
    label.textContent = title;
    wrap.append(label, ...children);
    return wrap;
  };

  /** Zahl mit Einheit – leer = Standard (der aktuelle Wert steht grau als Platzhalter darin) */
  function numberRow(title: string, value: number | undefined, unit: string, min: number, max: number, onChange: (value: number | undefined) => void, placeholder = '') {
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.value = value === undefined ? '' : String(value);
    input.placeholder = placeholder || 'Standard';
    input.addEventListener('input', () => onChange(input.value === '' ? undefined : Number(input.value)));
    const line = document.createElement('span');
    line.className = 'ub-num';
    line.append(input, unit);
    return row(title, line);
  }

  function selectRow(title: string, options: readonly (readonly [string, string])[], value: string, onChange: (value: string) => void) {
    const select = document.createElement('select');
    select.append(...options.map(([v, text]) => Object.assign(document.createElement('option'), { value: v, textContent: text, selected: v === value })));
    select.addEventListener('change', () => onChange(select.value));
    return row(title, select);
  }

  function toggleRow(title: string, checked: boolean, onChange: (checked: boolean) => void) {
    const label = document.createElement('label');
    label.className = 'ub-f ub-f--toggle';
    const input = Object.assign(document.createElement('input'), { type: 'checkbox', checked });
    input.addEventListener('change', () => onChange(input.checked));
    label.append(input, title);
    return label;
  }

  /** Farbe mit Schnellauswahl der Hausfarben – „Standard“ entfernt die eigene Farbe */
  function colorRow(title: string, value: string, onChange: (value: string | undefined) => void) {
    const line = document.createElement('span');
    line.className = 'ub-color';
    const input = Object.assign(document.createElement('input'), { type: 'color', value: value || '#ffffff' });
    const code = document.createElement('code');
    const show = (color: string | undefined) => {
      code.textContent = color ? color.toUpperCase() : 'Standard';
      line.classList.toggle('is-default', !color);
    };
    show(value || undefined);
    const apply = (color: string | undefined) => {
      if (color) input.value = color;
      show(color);
      onChange(color);
    };
    input.addEventListener('input', () => apply(input.value));
    const root = getComputedStyle(document.documentElement);
    const brand: [string, string][] = [
      ['Onyx', root.getPropertyValue('--onyx-950')],
      ['Onyx hell', root.getPropertyValue('--onyx-600')],
      ['Grau', root.getPropertyValue('--gray-500')],
      ['Hellgrau', root.getPropertyValue('--gray-50')],
      ['Weiß', '#ffffff'],
      ['Gelb', root.getPropertyValue('--yellow-500')],
    ];
    const swatches = document.createElement('span');
    swatches.className = 'ub-swatches';
    for (const [name, color] of brand) {
      const hex = toHex(color);
      const b = button('', () => apply(hex), name);
      b.style.setProperty('--swatch', hex);
      swatches.append(b);
    }
    const reset = button('Standard', () => apply(undefined), 'Eigene Farbe entfernen');
    reset.className = 'ub-color__reset';
    line.append(input, code, swatches, reset);
    return row(title, line);
  }

  const toHex = (color: string) => {
    const probe = document.createElement('span');
    probe.style.color = color.trim();
    document.body.append(probe);
    const rgb = getComputedStyle(probe).color.match(/\d+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
    probe.remove();
    return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  };

  /** Vier Werte (oben, rechts, unten, links) – Platzhalter zeigen die aktuellen Werte */
  function sidesRow(block: Block, key: 'margin' | 'padding', title: string) {
    const el = blockEl(block.id);
    const computed = el ? getComputedStyle(el) : null;
    const grid = document.createElement('span');
    grid.className = 'ed-sides';
    for (const [side, label] of [['top', 'Oben'], ['right', 'Rechts'], ['bottom', 'Unten'], ['left', 'Links']] as const) {
      const input = document.createElement('input');
      input.type = 'number';
      input.min = key === 'padding' ? '0' : '-400';
      input.max = '400';
      input.value = block.style?.[key]?.[side] === undefined ? '' : String(block.style[key]![side]);
      input.placeholder = computed ? String(Math.round(parseFloat(computed.getPropertyValue(`${key}-${side}`)) || 0)) : '';
      input.title = `${label} in px – leer = Standard`;
      input.addEventListener('input', () =>
        setStyle(block, { [key]: { ...block.style?.[key], [side]: input.value === '' ? undefined : Number(input.value) } }),
      );
      const cell = document.createElement('label');
      const small = document.createElement('small');
      small.textContent = label;
      cell.append(small, input);
      grid.append(cell);
    }
    return row(title, grid);
  }

  /** Ausrichtung als Symbolknöpfe */
  function alignRow(block: Block, withJustify: boolean) {
    const style = block.style ?? {};
    const choices: [BlockStyle['align'], string, string][] = [
      ['left', 'align-left', 'Links'],
      ['center', 'align-center', 'Mitte'],
      ['right', 'align-right', 'Rechts'],
      ...(withJustify ? ([['justify', 'align-justify', 'Blocksatz']] as [BlockStyle['align'], string, string][]) : []),
    ];
    const bar = document.createElement('span');
    bar.className = 'ub-align';
    for (const [value, icon, label] of choices) {
      const b = button('', () => setStyle(block, { align: style.align === value ? undefined : value }), label);
      b.innerHTML = data.icons[icon] ?? '';
      b.setAttribute('aria-pressed', String(style.align === value));
      bar.append(b);
    }
    return row('Ausrichtung', bar);
  }

  /** Design Hell/Dunkel – bei Abschnitt, Karte und Button über deren eigenes Feld, sonst style.tone */
  function designRows(block: Block): HTMLElement[] {
    const spec = BLOCK_DESIGN[block.type];
    if (!spec.key || !spec.options) {
      return [designToggle({ mode: spec.mode, value: block.style?.tone ?? '', onChange: (value) => setStyle(block, { tone: (value || undefined) as BlockStyle['tone'] }) })];
    }
    const key = spec.key;
    // Schalter und Auswahl steuern dasselbe Feld – danach neu aufbauen, damit beide übereinstimmen
    const apply = (value: string) => {
      setProp(block, key, value);
      buildPanel(block);
    };
    const rows: HTMLElement[] = [designToggle({ mode: spec.mode, value: String(block.props[key] ?? ''), options: spec.options, onChange: apply })];
    // Mehr Varianten als Hell/Dunkel (z. B. Karte mit Schatten, gelber Button): zusätzlich als Auswahl
    const field = blockDef(block.type)?.fields.find((f) => f.key === key);
    if (field?.kind === 'select' && field.options.length > spec.options.length) {
      rows.push(selectRow(field.label, field.options, String(block.props[key] ?? ''), apply));
    }
    return rows;
  }

  /**
   * Gestaltung in Unterabschnitten – nur, was für den Elementtyp sinnvoll ist (src/lib/blocks/style.ts → STYLE_OPTIONS):
   * Design (Hell/Dunkel, Farben), Schrift, Abstände, Form, Sichtbarkeit
   */
  function styleGroups(block: Block): HTMLElement[] {
    const options = STYLE_OPTIONS[block.type];
    const style = block.style ?? {};
    const el = blockEl(block.id);
    const fontEl = el && options.font !== undefined ? ((options.font ? el.querySelector<HTMLElement>(options.font.trim()) : el) ?? el) : null;
    const groups: HTMLElement[] = [];
    const has = (name: (typeof options.groups)[number]) => options.groups.includes(name);
    const colors = has('colors') ? (options.colors ?? ['text', 'bg', 'accent']) : [];
    const colorLabels = { text: 'Schriftfarbe', bg: block.type === 'button' ? 'Button-Fläche' : 'Hintergrundfarbe', accent: 'Akzentfarbe (Marker, Icons, Linien)' };
    const colorKeys = { text: 'textColor', bg: 'bgColor', accent: 'accentColor' } as const;

    groups.push(
      subsection(
        'Design',
        ...designRows(block),
        ...colors.map((color) => colorRow(colorLabels[color], style[colorKeys[color]] ?? '', (c) => setStyle(block, { [colorKeys[color]]: c }))),
      ),
    );

    if (has('font')) {
      const current = fontEl ? getComputedStyle(fontEl) : null;
      groups.push(
        subsection(
          'Schrift',
          numberRow('Größe', style.fontSize, 'px', 8, 160, (v) => setStyle(block, { fontSize: v }), current ? String(Math.round(parseFloat(current.fontSize))) : ''),
          selectRow(
            'Stärke',
            [
              ['', 'Standard'],
              ['400', 'Normal'],
              ['500', 'Mittel'],
              ['600', 'Halbfett'],
              ['700', 'Fett'],
              ['800', 'Extrafett'],
            ],
            style.fontWeight ?? '',
            (v) => setStyle(block, { fontWeight: (v || undefined) as BlockStyle['fontWeight'] }),
          ),
          has('align') && alignRow(block, true),
          toggleRow('Kursiv', Boolean(style.italic), (v) => setStyle(block, { italic: v || undefined })),
          toggleRow('Großbuchstaben', Boolean(style.uppercase), (v) => setStyle(block, { uppercase: v || undefined })),
        ),
      );
    }

    if (has('spacing')) {
      groups.push(
        subsection(
          'Abstände',
          sidesRow(block, 'margin', 'Außen'),
          options.padding !== false && sidesRow(block, 'padding', 'Innen'),
          hint('Werte in Pixel – leer = Standard. Große Werte werden auf dem Handy kleiner.'),
        ),
      );
    }

    if ((has('align') && !has('font')) || has('box') || has('size')) {
      groups.push(
        subsection(
          'Form',
          has('align') && !has('font') && alignRow(block, false),
          has('box') && numberRow('Ecken abrunden', style.radius, 'px', 0, 200, (v) => setStyle(block, { radius: v })),
          has('box') && numberRow('Rahmenstärke', style.borderWidth, 'px', 0, 20, (v) => setStyle(block, { borderWidth: v })),
          has('box') && colorRow('Rahmenfarbe', style.borderColor ?? '', (c) => setStyle(block, { borderColor: c })),
          has('box') &&
            selectRow(
              'Schatten',
              [
                ['', 'Ohne / Standard'],
                ['klein', 'Leicht'],
                ['gross', 'Stark'],
              ],
              style.shadow ?? '',
              (v) => setStyle(block, { shadow: (v || undefined) as BlockStyle['shadow'] }),
            ),
          has('size') && numberRow('Maximale Breite', style.maxWidth, 'px', 40, 2400, (v) => setStyle(block, { maxWidth: v }), 'volle Breite'),
        ),
      );
    }

    if (has('visibility')) {
      groups.push(
        subsection(
          'Sichtbarkeit',
          selectRow(
            'Anzeigen auf',
            [
              ['', 'Handy und Computer'],
              ['mobil', 'Nur Computer (auf dem Handy ausblenden)'],
              ['desktop', 'Nur Handy (am Computer ausblenden)'],
            ],
            style.hide ?? '',
            (v) => setStyle(block, { hide: (v || undefined) as BlockStyle['hide'] }),
          ),
        ),
      );
    }

    if (block.style) {
      const reset = button('Gestaltung zurücksetzen', () => {
        delete block.style;
        changed();
        buildPanel(block);
      });
      reset.className = 'ed-btn ed-btn--ghost ed-btn--block';
      const foot = document.createElement('div');
      foot.className = 'ed-panel__foot';
      foot.append(reset);
      groups.push(foot);
    }
    return groups;
  }

  function hint(text: string) {
    const small = document.createElement('small');
    small.className = 'ed-note';
    small.textContent = text;
    return small;
  }

  function button(text: string, onClick: () => void, title?: string) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    if (title) {
      b.title = title;
      b.setAttribute('aria-label', title);
    }
    b.addEventListener('click', (event) => {
      event.preventDefault();
      onClick();
    });
    return b;
  }

  /* ---------------- Bildauswahl ---------------- */
  let pickerState: { multiple: boolean; selected: string[]; done: (names: string[]) => void } | null = null;

  const renderPicker = () => {
    if (!pickerState) return;
    const all = [...[...localImages.keys()].map((name) => ({ name, thumb: localImages.get(name)! })), ...data.images];
    pickerGrid.replaceChildren(
      ...all.map(({ name, thumb }) => {
        const li = document.createElement('li');
        const choice = document.createElement('button');
        choice.type = 'button';
        choice.className = 'hero-choice';
        choice.title = name;
        choice.setAttribute('aria-pressed', String(pickerState!.selected.includes(name)));
        choice.append(Object.assign(document.createElement('img'), { src: thumb, alt: name, loading: 'lazy', decoding: 'async', width: 320, height: 200 }));
        choice.addEventListener('click', () => {
          const current = pickerState!;
          if (!current.multiple) {
            current.done([name]);
            picker.close();
            return;
          }
          current.selected = current.selected.includes(name) ? current.selected.filter((n) => n !== name) : [...current.selected, name];
          choice.setAttribute('aria-pressed', String(current.selected.includes(name)));
          pickerDone.textContent = `Übernehmen (${current.selected.length})`;
        });
        li.append(choice);
        return li;
      }),
    );
    pickerDone.hidden = !pickerState.multiple;
    pickerDone.textContent = `Übernehmen (${pickerState.selected.length})`;
  };

  const openPicker = (options: { multiple: boolean; selected: string[]; title: string; done: (names: string[]) => void }) => {
    pickerState = options;
    pickerTitle.textContent = options.title;
    pickerStatus.textContent = options.multiple ? 'Bilder anklicken zum Aus- und Abwählen – Reihenfolge danach in den Einstellungen.' : '';
    pickerUpload.multiple = options.multiple;
    renderPicker();
    picker.showModal();
  };

  /** Bildauswahl für ein Bild-Feld (`key`: image, bgImage …) bzw. die Bilder einer Galerie */
  function openPickerFor(block: Block, key = 'image') {
    if (block.type === 'gallery') {
      openPicker({
        multiple: true,
        title: 'Bilder für die Galerie',
        selected: (Array.isArray(block.props.images) ? block.props.images : []).map(String),
        done: (names) => {
          setProp(block, 'images', names);
          hooks.select(block.id);
        },
      });
    } else {
      openPicker({
        multiple: false,
        title: 'Bild auswählen',
        selected: block.props[key] ? [String(block.props[key])] : [],
        done: ([name]) => setProp(block, key, name),
      });
    }
  }

  pickerDone.addEventListener('click', () => {
    pickerState?.done(pickerState.selected);
    picker.close();
  });

  pickerUpload.addEventListener('change', async () => {
    const files = [...(pickerUpload.files ?? [])];
    pickerUpload.value = '';
    if (!files.length || !pickerState) return;
    try {
      for (const [i, file] of files.entries()) {
        pickerStatus.textContent = files.length > 1 ? `Lade Bild ${i + 1} von ${files.length} hoch …` : 'Bild wird hochgeladen …';
        const base64 = await hooks.shrink(file);
        const response = await fetch(`/api/edit/bild/?folder=bausteine&name=neu-${Date.now().toString(36)}-${i}.jpg`, {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body: base64,
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Hochladen fehlgeschlagen.');
        const name = `bausteine/${result.name}`;
        localImages.set(name, `data:image/jpeg;base64,${base64}`);
        if (!pickerState.multiple) {
          pickerState.done([name]);
          picker.close();
          return;
        }
        pickerState.selected.push(name);
      }
      pickerStatus.textContent = 'Hochgeladen – nach dem nächsten Build auch in bester Qualität.';
      renderPicker();
    } catch (error) {
      pickerStatus.textContent = error instanceof Error ? error.message : 'Hochladen fehlgeschlagen.';
    }
  });

  /* ---------------- Auswahl in der Seitenleiste ---------------- */
  const showTab = (id: string) => {
    library.querySelectorAll<HTMLElement>('[data-ub-tab]').forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.ubTab === id)));
    library.querySelectorAll<HTMLElement>('[data-ub-tabpanel]').forEach((p) => (p.hidden = p.dataset.ubTabpanel !== id));
  };
  library.querySelectorAll<HTMLElement>('[data-ub-tab]').forEach((tab) => tab.addEventListener('click', () => showTab(tab.dataset.ubTab!)));
  library.querySelectorAll<HTMLElement>('[data-ub-choice]').forEach((tile) => {
    const item: Placing = { choice: tile.dataset.ubChoice!, label: tile.querySelector('strong')?.textContent ?? 'Element' };
    // Ziehen: direkt an die Stelle auf der Seite · Klick: an die gewählte Stelle oder danach die Stelle anklicken
    tile.addEventListener('pointerdown', (event) => ready && beginDrag(event, item));
    tile.addEventListener('click', () => {
      if (!ready) return hooks.status('Elemente werden noch geladen …');
      const target = hooks.takeTarget();
      if (target) insertAt(item.choice, target.target, target.index, 'center');
      else setPlacing(item);
    });
  });

  /* ---------------- Vorschauen in der Auswahl ---------------- */
  const previewSheet = new CSSStyleSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, previewSheet];
  let previewsBuilt = false;

  /** Beispielbilder der Website, damit die Vorschau wie auf der Seite aussieht */
  const withSamples = (block: Block, counter = { n: 0 }): Block => {
    const pics = data.images.map((image) => image.name);
    const def = blockDef(block.type);
    for (const field of def?.fields ?? []) {
      if (!pics.length) break;
      if (field.kind === 'image' && field.key === 'image' && !block.props.image) block.props.image = pics[counter.n++ % pics.length];
      if (field.kind === 'images' && !(block.props[field.key] as unknown[] | undefined)?.length) {
        block.props[field.key] = [0, 1, 2, 3].map(() => pics[counter.n++ % pics.length]);
      }
    }
    // Leere Container mit Beispielinhalt zeigen
    if (def?.group === 'container') {
      block.slots?.forEach((slot, i) => {
        if (slot.length) return;
        slot.push(createBlock('heading', { text: i ? 'Weitere Spalte' : 'Überschrift' }), createBlock('text'));
      });
    }
    block.slots?.forEach((slot) => slot.forEach((child) => withSamples(child, counter)));
    return block;
  };

  /** Vorschau in Originalbreite zeichnen und auf die Kachel verkleinern */
  const fitPreview = (frame: HTMLElement) => {
    const stage = frame.firstElementChild as HTMLElement | null;
    const width = frame.clientWidth;
    if (!stage || !width) return;
    const scale = width / Number(frame.dataset.stage);
    const natural = stage.offsetHeight * scale;
    const height = Math.max(56, Math.min(Number(frame.dataset.max), natural));
    frame.style.setProperty('--ub-scale', String(scale));
    frame.style.setProperty('--ub-top', `${Math.max(0, (height - natural) / 2)}px`);
    frame.style.setProperty('height', `${Math.round(height)}px`);
  };
  const previewObserver = new ResizeObserver((entries) => {
    for (const { target } of entries) fitPreview(target.matches('[data-ub-stage]') ? target.parentElement! : (target as HTMLElement));
  });

  const buildPreviews = () => {
    if (previewsBuilt) return;
    previewsBuilt = true;
    const previewCtx: RenderContext = {
      ...ctx,
      editing: false,
      // Kleine Vorschaubilder genügen
      image: (name) => {
        const image = imageMap.get(name);
        return image ? { src: image.thumb, width: image.width, height: image.height } : ctx.image(name);
      },
    };
    // Breite, in der die Vorschauen gezeichnet und dann verkleinert werden – passend zum Gerät,
    // denn die Elemente richten sich nach der Bildschirmbreite (Handy: gestapelt, Computer: nebeneinander)
    const stageWidth = { preset: Math.round(Math.min(1200, Math.max(560, innerWidth))), block: Math.round(Math.min(620, Math.max(420, innerWidth * 0.6))) };
    let css = '';
    library.querySelectorAll<HTMLElement>('[data-ub-choice]').forEach((tile) => {
      const frame = tile.querySelector<HTMLElement>('[data-ub-preview]');
      const stage = frame?.querySelector<HTMLElement>('[data-ub-stage]');
      const block = build(tile.dataset.ubChoice!);
      if (!frame || !stage || !block) return;
      const preset = tile.dataset.ubChoice!.startsWith('preset:');
      withSamples(block);
      frame.dataset.stage = String(preset ? stageWidth.preset : stageWidth.block);
      frame.dataset.max = String(preset ? 190 : 130);
      stage.style.setProperty('width', `${frame.dataset.stage}px`);
      // Vorlagen wie zwischen den Abschnitten, einzelne Elemente ohne Seitenraster
      stage.innerHTML = renderZone([block], previewCtx, preset ? '1' : '@1|after');
      stage.querySelectorAll('img').forEach((img) => (img.draggable = false));
      css += blocksCss([block], previewCtx.image);
      previewObserver.observe(frame);
      previewObserver.observe(stage);
    });
    previewSheet.replaceSync(css);
  };

  /* ---------------- Ereignisse auf der Seite ---------------- */
  // „+“-Felder in Zonen und Containern → Einfügen-Bereich der Seitenleiste mit diesem Ziel
  document.addEventListener(
    'click',
    (event) => {
      if (!active || !ready || placing) return;
      const add = (event.target as HTMLElement).closest<HTMLElement>('[data-ub-add]');
      if (!add || !main?.contains(add)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      hooks.openInsert({ target: add.dataset.ubAdd!, label: describeTarget(add.dataset.ubAdd!) });
    },
    true,
  );

  // Esc bricht Ziehen und Platzieren ab (sonst entscheidet die Seitenleiste)
  document.addEventListener(
    'keydown',
    (event) => {
      if (!active || event.key !== 'Escape' || (!drag && !placing)) return;
      event.stopImmediatePropagation();
      if (drag) endDrag();
      else setPlacing(null);
    },
    true,
  );

  let frame = 0;
  const reposition = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => pendingDrop && showDrop(pendingDrop, true));
  };
  window.addEventListener('scroll', reposition, { passive: true });
  window.addEventListener('resize', reposition);

  const labelOf = (block: Block) => blockDef(block.type)?.label ?? 'Element';

  /* ---------------- Öffentliche Schnittstelle ---------------- */
  return {
    async start() {
      if (!main) return;
      active = true;
      ready = false;
      const current = ++session;
      hooks.status('Elemente werden geladen …');
      try {
        const [editorData, remote] = await Promise.all([
          data.images.length ? data : fetch('/bearbeiten/bausteine.json').then((r) => r.json() as Promise<EditorData>),
          fetch(`/api/edit/bausteine/?page=${encodeURIComponent(location.pathname)}`).then((r) => r.json()),
        ]);
        if (current !== session || !active) return;
        if (!remote?.ok) throw new Error(remote?.error || 'Elemente konnten nicht geladen werden.');
        data = editorData;
        imageMap = new Map(data.images.map((image) => [image.name, image]));
        // Stand aus GitHub – ist nach dem Speichern aktueller als die Seite, bis der Build durch ist
        state = clampZones(sanitizePage(remote.zones), sections().length);
        saved = JSON.stringify(state);
        ready = true;
        const built = document.querySelector<HTMLStyleElement>('style[data-ub-style]')?.sheet;
        if (built) built.disabled = true;
        ensureZones();
        render();
        buildPreviews();
        hooks.onChange();
      } catch (error) {
        if (current !== session) return;
        hooks.status(`${error instanceof Error ? error.message : 'Elemente konnten nicht geladen werden.'} Texte lassen sich trotzdem ändern.`);
      }
    },
    stop() {
      if (drag) endDrag();
      setPlacing(null);
      active = false;
      session++;
      panelFor = null;
      if (ready) render();
      ready = false;
    },
    dirty: () => ready && JSON.stringify(state) !== saved,
    discard() {
      if (!ready) return;
      state = JSON.parse(saved);
      ensureZones();
      render();
    },
    isReady: () => ready,
    /** Element aus dem Baukasten auf der Seite */
    element: (id: string) => blockEl(id),
    /** Kurzinfo für die Seitenleiste */
    info(id: string) {
      const loc = find(id);
      if (!loc) return null;
      const def = blockDef(loc.block.type);
      return {
        id,
        type: loc.block.type,
        label: labelOf(loc.block),
        parentId: loc.parent?.id ?? null,
        canUp: canMove(loc, -1),
        canDown: canMove(loc, 1),
        container: Boolean(loc.block.slots?.length),
        hasFields: Boolean(def?.fields.length),
      };
    },
    /** Inhalt und Gestaltung eines Elements in einen Behälter der Seitenleiste zeichnen */
    renderInspector(id: string, container: HTMLElement) {
      const loc = find(id);
      panelFields = container;
      panelFor = null;
      if (loc) buildPanel(loc.block);
    },
    moveBy,
    duplicate,
    remove,
    /** Verschieben: Klick → Stelle auf der Seite anklicken · Ziehen (Maus) → direkt ablegen */
    startMove(id: string, event?: PointerEvent) {
      const loc = find(id);
      if (!loc) return;
      const item: Placing = { id, label: labelOf(loc.block) };
      if (event) beginDrag(event, item);
      else setPlacing(item);
    },
    cancelPlacing: () => setPlacing(null),
    isPlacing: () => Boolean(placing || drag?.started),
    targetFor,
    insert(choice: string, target: InsertTarget) {
      insertAt(choice, target.target, target.index, 'center');
    },
    showLibraryTab: showTab,
    async save() {
      const response = await fetch('/api/edit/bausteine/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: location.pathname, zones: state }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Elemente konnten nicht gespeichert werden.');
      state = clampZones(sanitizePage(result.zones), sections().length);
      saved = JSON.stringify(state);
      render();
    },
  };
}
