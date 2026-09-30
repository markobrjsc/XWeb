/**
 * Element-Editor im Bearbeiten-Modus (gestartet von src/components/debug/EditMode.astro).
 *
 *  · „+ Element hier einfügen“ zwischen den Abschnitten jeder Seite und in jedem Container
 *    → Auswahl aus Vorlagen, Basis-Elementen und Containern (src/components/debug/BlockEditorUI.astro)
 *  · Texte direkt anklicken und ändern, Bilder/Symbole anklicken zum Austauschen
 *  · Element anklicken → Werkzeugleiste: übergeordnetes wählen, hoch/runter, danach einfügen, duplizieren,
 *    verschieben (auch in andere Container und zwischen Abschnitte), Einstellungen, löschen
 *  · Speichern über den gemeinsamen Knopf → POST /api/edit/bausteine/ → src/content/blocks.json
 *
 * Die Vorschau entsteht mit demselben Renderer wie beim Build (src/lib/blocks/render.ts).
 */
import { PRESETS } from '@/lib/blocks/presets';
import { renderZone, type RenderContext } from '@/lib/blocks/render';
import { STYLE_OPTIONS, blocksCss } from '@/lib/blocks/style';
import {
  type Block,
  type BlockStyle,
  type BlockType,
  type Field,
  type PageBlocks,
  BLOCK_ICONS,
  blockDef,
  clampZones,
  createBlock,
  isValidLink,
  newId,
  sanitizePage,
  sanitizeStyle,
} from '@/lib/blocks/schema';

type EditorImage = { name: string; thumb: string; src: string; width: number; height: number };
type EditorData = { images: EditorImage[]; icons: Record<string, string> };
type Location = { list: Block[]; index: number; block: Block; parent: Block | null; zone: string };

export interface BlockEditorHooks {
  /** Änderungen an Elementen – Speicherleiste aktualisieren */
  onChange(): void;
  /** Bild vor dem Hochladen verkleinern → Base64 (JPEG) */
  shrink(file: File): Promise<string>;
  /** Statusmeldung in der Speicherleiste */
  status(message: string): void;
}

const SITE_LINKS = ['/', '/leistungen/', '/stellenangebote/', '/betrieb/', '/kontakt/', '/stellenangebote/initiativ/', '/impressum/', '/datenschutz/'];

export function createBlockEditor(ui: HTMLElement, hooks: BlockEditorHooks) {
  const main = document.querySelector<HTMLElement>('main');
  const library = ui.querySelector<HTMLDialogElement>('[data-ub-library]')!;
  const libraryWhere = library.querySelector<HTMLElement>('[data-ub-library-where]')!;
  const toolbar = ui.querySelector<HTMLElement>('[data-ub-toolbar]')!;
  const toolbarLabel = toolbar.querySelector<HTMLElement>('[data-ub-toolbar-label]')!;
  const movebar = ui.querySelector<HTMLElement>('[data-ub-movebar]')!;
  const panel = ui.querySelector<HTMLElement>('[data-ub-panel]')!;
  const panelTitle = panel.querySelector<HTMLElement>('[data-ub-panel-title]')!;
  const panelFields = panel.querySelector<HTMLElement>('[data-ub-panel-fields]')!;
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
  let selectedId: string | null = null;
  let movingId: string | null = null;
  let insertTarget: { target: string; index?: number } | null = null;
  /** Für welches Element das Einstellungs-Feld gerade aufgebaut ist */
  let panelFor: string | null = null;

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
  const sections = () => (main ? [...main.children].filter((el) => el.tagName !== 'UB-ZONE') : []);
  const zoneEl = (key: string) => main?.querySelector<HTMLElement>(`:scope > ub-zone[data-ub-zone="${key}"]`) ?? null;

  /** Nach jedem Abschnitt eine (ggf. leere) Zone bereitstellen */
  const ensureZones = () => {
    sections().forEach((section, i) => {
      const key = String(i + 1);
      if (zoneEl(key)) return;
      const zone = document.createElement('ub-zone');
      zone.dataset.ubZone = key;
      section.after(zone);
    });
  };

  const render = () => {
    if (!main) return;
    const editing = active && ready;
    main.querySelectorAll<HTMLElement>(':scope > ub-zone').forEach((zone) => {
      const key = zone.dataset.ubZone ?? '';
      const blocks = state[key] ?? [];
      if (!editing && !blocks.length) {
        zone.remove();
        return;
      }
      zone.innerHTML = renderZone(blocks, { ...ctx, editing }, key);
    });
    updateCss();
    if (!editing) return;
    main.querySelectorAll<HTMLElement>('[data-ub-field]').forEach((field) => {
      field.contentEditable = supportsPlain ? 'plaintext-only' : 'true';
      field.spellcheck = true;
    });
    if (selectedId && !find(selectedId)) selectedId = null;
    markSelection();
    if (movingId) markMoveTargets();
  };

  const supportsPlain = (() => {
    const probe = document.createElement('div');
    probe.contentEditable = 'plaintext-only';
    return probe.contentEditable === 'plaintext-only';
  })();

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

  /* ---------------- Auswahl & Werkzeugleiste ---------------- */
  const blockEl = (id: string) => main?.querySelector<HTMLElement>(`[data-ub="${id}"]`) ?? null;

  const markSelection = () => {
    main?.querySelectorAll('.ub-selected').forEach((el) => el.classList.remove('ub-selected'));
    const el = selectedId ? blockEl(selectedId) : null;
    if (!el || !selectedId) {
      toolbar.hidden = true;
      panel.hidden = true;
      return;
    }
    el.classList.add('ub-selected');
    const loc = find(selectedId)!;
    const def = blockDef(loc.block.type);
    toolbarLabel.textContent = def?.label ?? loc.block.type;
    const zoneKeys = Object.keys(state).map(Number);
    const firstZone = loc.parent === null && loc.index === 0 && Number(loc.zone) <= 1;
    const lastZone = loc.parent === null && loc.index === loc.list.length - 1 && Number(loc.zone) >= Math.max(sections().length, ...zoneKeys);
    toolbar.querySelector<HTMLButtonElement>('[data-ub-action="parent"]')!.disabled = !loc.parent;
    toolbar.querySelector<HTMLButtonElement>('[data-ub-action="up"]')!.disabled = loc.parent ? loc.index === 0 : firstZone;
    toolbar.querySelector<HTMLButtonElement>('[data-ub-action="down"]')!.disabled = loc.parent ? loc.index === loc.list.length - 1 : lastZone;
    toolbar.hidden = false;
    placeToolbar();
    if (!panel.hidden && panelFor !== loc.block.id) buildPanel(loc.block);
  };

  const placeToolbar = () => {
    const el = selectedId ? blockEl(selectedId) : null;
    if (!el || toolbar.hidden) return;
    const r = el.getBoundingClientRect();
    const height = toolbar.offsetHeight;
    const width = toolbar.offsetWidth;
    const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    let top = r.top - height - 8;
    if (top < headerBottom + 4) top = Math.min(Math.max(r.top + 8, headerBottom + 4), window.innerHeight - height - 8);
    toolbar.style.top = `${Math.round(top)}px`;
    toolbar.style.left = `${Math.round(Math.min(Math.max(8, r.left), window.innerWidth - width - 8))}px`;
  };

  const select = (id: string | null) => {
    if (id !== selectedId) panelFor = null;
    selectedId = id;
    if (!id) panel.hidden = true;
    markSelection();
  };

  /* ---------------- Aktionen ---------------- */
  const moveBy = (id: string, step: -1 | 1) => {
    const loc = find(id);
    if (!loc) return;
    const to = loc.index + step;
    if (to >= 0 && to < loc.list.length) {
      loc.list.splice(loc.index, 1);
      loc.list.splice(to, 0, loc.block);
    } else if (!loc.parent) {
      // Oberste Ebene: in die Zone vor bzw. nach dem benachbarten Abschnitt wechseln
      const next = Number(loc.zone) + step;
      if (next < 1 || next > sections().length) return;
      loc.list.splice(loc.index, 1);
      if (!loc.list.length) delete state[loc.zone];
      const list = (state[String(next)] ??= []);
      if (step < 0) list.push(loc.block);
      else list.unshift(loc.block);
    } else return;
    changed();
    blockEl(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const remove = (id: string) => {
    const loc = find(id);
    if (!loc) return;
    const hasChildren = loc.block.slots?.some((slot) => slot.length);
    if (hasChildren && !confirm(`„${blockDef(loc.block.type)?.label}“ mit allen enthaltenen Elementen löschen?`)) return;
    loc.list.splice(loc.index, 1);
    if (!loc.parent && !loc.list.length) delete state[loc.zone];
    selectedId = loc.parent?.id ?? null;
    changed();
  };

  const duplicate = (id: string) => {
    const loc = find(id);
    if (!loc) return;
    const copy = cloneWithNewIds(loc.block);
    loc.list.splice(loc.index + 1, 0, copy);
    selectedId = copy.id;
    changed();
  };

  const openLibrary = (target: string, index?: number) => {
    insertTarget = { target, index };
    const [owner] = target.split(':');
    const parent = owner === 'zone' ? null : find(owner)?.block;
    libraryWhere.textContent = parent ? `Einfügen in: ${blockDef(parent.type)?.label}` : 'Einfügen zwischen den Abschnitten';
    // Auf oberster Ebene zuerst Vorlagen, in Containern zuerst Basis-Elemente
    showTab(parent ? 'basis' : 'vorlagen');
    library.showModal();
  };

  const insert = (choice: string) => {
    if (!insertTarget) return;
    const [kind, name] = choice.split(':');
    const block = kind === 'preset' ? PRESETS.find((preset) => preset.id === name)?.build() : blockDef(name) ? createBlock(name as BlockType) : undefined;
    const list = listFor(insertTarget.target);
    if (!block || !list) return;
    list.splice(insertTarget.index ?? list.length, 0, block);
    library.close();
    selectedId = block.id;
    changed();
    requestAnimationFrame(() => blockEl(block.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    // Neues Bild-Element: gleich die Bildauswahl öffnen
    if (block.type === 'image' || block.type === 'gallery') openPickerFor(block);
  };

  /* ---------------- Verschieben ---------------- */
  const markMoveTargets = () => {
    const moving = movingId ? find(movingId)?.block : null;
    main?.querySelectorAll<HTMLElement>('.ub-add').forEach((button) => {
      const [owner] = (button.dataset.ubAdd ?? '').split(':');
      const invalid = moving && owner !== 'zone' && (contains(moving, owner) || false);
      button.toggleAttribute('data-ub-invalid', Boolean(invalid));
      const label = button.querySelector('span');
      if (label) {
        label.dataset.label ??= label.textContent ?? '';
        label.textContent = movingId ? 'Hierher' : label.dataset.label;
      }
    });
  };

  const setMoving = (id: string | null) => {
    movingId = id;
    document.documentElement.classList.toggle('ub-moving', Boolean(id));
    movebar.hidden = !id;
    render();
  };

  const moveTo = (target: string) => {
    const loc = movingId ? find(movingId) : null;
    if (!loc) return setMoving(null);
    const [owner] = target.split(':');
    if (owner !== 'zone' && contains(loc.block, owner)) return;
    loc.list.splice(loc.index, 1);
    if (!loc.parent && !loc.list.length) delete state[loc.zone];
    const list = listFor(target);
    list?.push(loc.block);
    selectedId = loc.block.id;
    setMoving(null);
    hooks.onChange();
  };

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
    // Felder mit Vorschau (Bild, Galerie, Symbol) im Einstellungs-Feld neu aufbauen
    const kind = def?.fields.find((f) => f.key === key)?.kind;
    if (!panel.hidden && panelFor === block.id && (kind === 'image' || kind === 'images' || kind === 'icon')) buildPanel(block);
  };

  function buildPanel(block: Block) {
    const def = blockDef(block.type);
    if (!def) return;
    panelFor = block.id;
    panelTitle.textContent = `${def.label} – Einstellungen`;
    panelFields.replaceChildren(
      ...(def.fields.length ? [group('Inhalt', def.fields.map((field) => fieldControl(block, field)))] : []),
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
  /** Geöffnete Gruppen bleiben beim Wechsel zwischen Elementen offen */
  const openGroups = new Set<string>(['Inhalt']);

  function group(title: string, children: HTMLElement[]) {
    const details = document.createElement('details');
    details.className = 'ub-g';
    details.open = openGroups.has(title);
    const summary = document.createElement('summary');
    summary.textContent = title;
    details.append(summary, ...children);
    details.addEventListener('toggle', () => (details.open ? openGroups.add(title) : openGroups.delete(title)));
    return details;
  }

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

  function selectRow(title: string, options: [string, string][], value: string, onChange: (value: string) => void) {
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
    grid.className = 'ub-sides';
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
      cell.append(label, input);
      grid.append(cell);
    }
    return row(`${title} in px`, grid);
  }

  function styleGroups(block: Block): HTMLElement[] {
    const options = STYLE_OPTIONS[block.type];
    const style = block.style ?? {};
    const el = blockEl(block.id);
    const fontEl = el && options.font !== undefined ? ((options.font ? el.querySelector<HTMLElement>(options.font.trim()) : el) ?? el) : null;
    const groups: HTMLElement[] = [];
    const has = (name: (typeof options.groups)[number]) => options.groups.includes(name);

    if (has('align')) {
      const choices: [BlockStyle['align'], string, string][] = [
        ['left', 'align-left', 'Links'],
        ['center', 'align-center', 'Mitte'],
        ['right', 'align-right', 'Rechts'],
        ...(has('font') ? ([['justify', 'align-justify', 'Blocksatz']] as [BlockStyle['align'], string, string][]) : []),
      ];
      const bar = document.createElement('span');
      bar.className = 'ub-align';
      for (const [value, icon, label] of choices) {
        const b = button('', () => setStyle(block, { align: style.align === value ? undefined : value }), label);
        b.innerHTML = `${data.icons[icon] ?? ''}<span>${label}</span>`;
        b.setAttribute('aria-pressed', String(style.align === value));
        bar.append(b);
      }
      groups.push(group('Ausrichtung', [bar]));
    }

    if (has('colors')) {
      const isButton = block.type === 'button';
      groups.push(
        group('Farben', [
          colorRow('Schrift', style.textColor ?? '', (c) => setStyle(block, { textColor: c })),
          colorRow(isButton ? 'Button-Fläche' : 'Hintergrund', style.bgColor ?? '', (c) => setStyle(block, { bgColor: c })),
          ...(isButton ? [] : [colorRow('Akzent (Marker, Buttons, Icons, Linien)', style.accentColor ?? '', (c) => setStyle(block, { accentColor: c }))]),
        ]),
      );
    }

    if (has('font')) {
      const current = fontEl ? getComputedStyle(fontEl) : null;
      groups.push(
        group('Schrift', [
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
          toggleRow('Kursiv', Boolean(style.italic), (v) => setStyle(block, { italic: v || undefined })),
          toggleRow('Großbuchstaben', Boolean(style.uppercase), (v) => setStyle(block, { uppercase: v || undefined })),
        ]),
      );
    }

    if (has('spacing')) {
      groups.push(group('Abstände', [sidesRow(block, 'margin', 'Außen (margin)'), ...(block.type === 'spacer' ? [] : [sidesRow(block, 'padding', 'Innen (padding)')])]));
    }

    if (has('box')) {
      groups.push(
        group('Rahmen & Ecken', [
          numberRow('Ecken abrunden', style.radius, 'px', 0, 200, (v) => setStyle(block, { radius: v })),
          numberRow('Rahmenstärke', style.borderWidth, 'px', 0, 20, (v) => setStyle(block, { borderWidth: v })),
          colorRow('Rahmenfarbe', style.borderColor ?? '', (c) => setStyle(block, { borderColor: c })),
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
        ]),
      );
    }

    if (has('size')) {
      groups.push(group('Breite', [numberRow('Maximale Breite', style.maxWidth, 'px', 40, 2400, (v) => setStyle(block, { maxWidth: v }), 'volle Breite')]));
    }

    if (has('visibility')) {
      groups.push(
        group('Sichtbarkeit', [
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
        ]),
      );
    }

    if (block.style) {
      const reset = button('Gestaltung zurücksetzen', () => {
        delete block.style;
        changed();
        buildPanel(block);
      });
      reset.className = 'ub-f__mini ub-reset';
      groups.push(reset);
    }
    return groups;
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

  const openPanel = (id: string) => {
    const loc = find(id);
    if (!loc) return;
    select(id);
    panel.hidden = false;
    buildPanel(loc.block);
  };

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
          selectedId = block.id;
          openPanel(block.id);
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

  /* ---------------- Auswahl-Dialog ---------------- */
  const showTab = (id: string) => {
    library.querySelectorAll<HTMLElement>('[data-ub-tab]').forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.ubTab === id)));
    library.querySelectorAll<HTMLElement>('[data-ub-tabpanel]').forEach((p) => (p.hidden = p.dataset.ubTabpanel !== id));
  };
  library.querySelectorAll<HTMLElement>('[data-ub-tab]').forEach((tab) => tab.addEventListener('click', () => showTab(tab.dataset.ubTab!)));
  library.querySelectorAll<HTMLElement>('[data-ub-choice]').forEach((tile) => tile.addEventListener('click', () => insert(tile.dataset.ubChoice!)));

  /* ---------------- Ereignisse auf der Seite ---------------- */
  const onPage = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    return el && main?.contains(el) && el.closest('ub-zone') ? el : null;
  };

  document.addEventListener('click', (event) => {
    if (!active || !ready || document.documentElement.classList.contains('is-spacing')) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-ub-toolbar], [data-ub-panel], dialog')) return;
    const el = onPage(target);
    if (!el) {
      if (!target.closest('[data-edit-ui]')) select(null);
      return;
    }
    const add = el.closest<HTMLElement>('[data-ub-add]');
    if (add) {
      event.preventDefault();
      if (movingId) moveTo(add.dataset.ubAdd!);
      else openLibrary(add.dataset.ubAdd!);
      return;
    }
    const block = el.closest<HTMLElement>('[data-ub]');
    if (!block) return;
    if (movingId) return;
    select(block.dataset.ub!);
    const pick = el.closest<HTMLElement>('[data-ub-pick]');
    const loc = find(block.dataset.ub!);
    if (!pick || !loc) return;
    event.preventDefault();
    if (pick.dataset.ubPick === 'icon') openPanel(loc.block.id);
    else openPickerFor(loc.block);
  });

  // Nur das innerste Element beim Überfahren markieren
  let hovered: HTMLElement | null = null;
  document.addEventListener('mouseover', (event) => {
    if (!active || !ready) return;
    const next = onPage(event.target)?.closest<HTMLElement>('[data-ub]') ?? null;
    if (next === hovered) return;
    hovered?.classList.remove('ub-hover');
    hovered = next;
    hovered?.classList.add('ub-hover');
  });

  // Texte direkt auf der Seite ändern
  document.addEventListener('input', (event) => {
    if (!active || !ready) return;
    const field = onPage(event.target)?.closest<HTMLElement>('[data-ub-field]');
    const id = field?.closest<HTMLElement>('[data-ub]')?.dataset.ub;
    const loc = id ? find(id) : null;
    if (!field || !loc) return;
    const key = field.dataset.ubField!;
    const multiline = field.hasAttribute('data-ub-multiline');
    const text = multiline ? field.innerText.replace(/\n$/, '') : (field.textContent ?? '').replace(/\s+/g, ' ');
    const [prop, index] = key.split('.');
    if (index !== undefined) {
      const items = [...((loc.block.props[prop] as string[]) ?? [])];
      items[Number(index)] = text;
      loc.block.props[prop] = items;
    } else {
      loc.block.props[prop] = text;
    }
    hooks.onChange();
    placeToolbar();
  });

  toolbar.addEventListener('click', (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-ub-action]')?.dataset.ubAction;
    if (!action || !selectedId) return;
    const loc = find(selectedId);
    if (!loc) return;
    switch (action) {
      case 'parent':
        if (loc.parent) select(loc.parent.id);
        break;
      case 'up':
        moveBy(loc.block.id, -1);
        break;
      case 'down':
        moveBy(loc.block.id, 1);
        break;
      case 'add': {
        const target = loc.parent ? `${loc.parent.id}:${loc.parent.slots!.findIndex((slot) => slot === loc.list)}` : `zone:${loc.zone}`;
        openLibrary(target, loc.index + 1);
        break;
      }
      case 'duplicate':
        duplicate(loc.block.id);
        break;
      case 'move':
        setMoving(loc.block.id);
        break;
      case 'settings':
        if (panel.hidden) openPanel(loc.block.id);
        else panel.hidden = true;
        break;
      case 'delete':
        remove(loc.block.id);
        break;
    }
  });

  movebar.querySelector('[data-ub-move-cancel]')!.addEventListener('click', () => setMoving(null));
  panel.querySelector('[data-ub-panel-close]')!.addEventListener('click', () => (panel.hidden = true));

  document.addEventListener('keydown', (event) => {
    if (!active || event.key !== 'Escape') return;
    if (movingId) setMoving(null);
    else if (selectedId && !(event.target as HTMLElement).isContentEditable) select(null);
  });

  let frame = 0;
  const reposition = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(placeToolbar);
  };
  window.addEventListener('scroll', reposition, { passive: true });
  window.addEventListener('resize', reposition);

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
        hooks.onChange();
      } catch (error) {
        if (current !== session) return;
        hooks.status(`${error instanceof Error ? error.message : 'Elemente konnten nicht geladen werden.'} Texte lassen sich trotzdem ändern.`);
      }
    },
    stop() {
      active = false;
      session++;
      setMoving(null);
      select(null);
      hovered?.classList.remove('ub-hover');
      if (ready) render();
      ready = false;
    },
    dirty: () => ready && JSON.stringify(state) !== saved,
    discard() {
      if (!ready) return;
      state = JSON.parse(saved);
      select(null);
      ensureZones();
      render();
    },
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
