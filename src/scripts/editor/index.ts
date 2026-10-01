/**
 * Bearbeiten-Modus der Website – Seitenleiste links (Markup und Stile: src/components/debug/EditMode.astro).
 *
 *  Auswahl   Element auf der Seite anklicken: Text → nur der Text, freie Fläche → Karte/Abschnitt.
 *            Die Seitenleiste zeigt den Pfad und darunter einen Einstellungsbereich mit einklappbaren
 *            Unterabschnitten – nur mit den Einstellungen, die für die Elementart sinnvoll sind (./kinds.ts):
 *            Inhalt (Text, Kopfbild, Galerie, Projekte), Design (Hell/Dunkel, Farben), Schrift, Abstände, Form, Sichtbarkeit.
 *            Hoch/runter, verschieben, duplizieren, löschen: Werkzeugleiste direkt am Element.
 *  Einfügen  Vorlagen, Basis-Elemente und Container mit Vorschau – an die gewählte Stelle, per Drag & Drop
 *            auf die Seite oder antippen und Stelle anklicken (src/scripts/block-editor.ts).
 *  Ebenen    Aufbau der ganzen Seite als Baum.
 *  Abstände  Außen-/Innenabstände sichtbar machen und einstellen.
 *  „Seite bedienen“ (Hand-Symbol unten oder Alt + Klick): Reiter, Galerien usw. normal benutzen.
 *
 * Speichern schreibt Texte (edits.json), Gestaltung (spacing.json) und Elemente (blocks.json) als Commit auf main;
 * Kopfbilder, Galerien und neue Projekte speichern direkt in ihren Dialogen. Server-Teil: worker/edit.ts.
 */
import { createBlockEditor, type InsertTarget } from '@/scripts/block-editor';
import { axisOf, chainOf, childItems, h, isGlobal, isTextElement, isUi, kindAt, nameOf, parentOf, pickTarget, snippetOf, textNodes } from './dom';
import type { Control, Kind } from './kinds';
import { createMedia, shrink } from './media';
import { designToggle, subsection } from './panel';
import { projectsPanel } from './projects';
import { type StyleProp, createStyles } from './styles';
import { createTexts } from './texts';

type Tab = 'inspect' | 'insert' | 'layers' | 'spacing';

const SAVED = 'Gespeichert – nach dem automatischen Build in ca. 2 Minuten live.';
const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const SIDE_LABELS = { top: 'Oben', right: 'Rechts', bottom: 'Unten', left: 'Links' } as const;

export async function initEditor() {
  const ui = document.querySelector<HTMLElement>('[data-edit-ui]');
  const main = document.querySelector<HTMLElement>('main');
  if (!ui || !main) return;
  try {
    const status = await (await fetch('/api/edit/status/')).json();
    if (!status?.enabled) return;
  } catch {
    return;
  }
  ui.hidden = false;

  const $ = <T extends Element = HTMLElement>(selector: string) => ui.querySelector<T>(selector)!;
  const toggle = $<HTMLButtonElement>('[data-ed-toggle]');
  const sidebar = $('[data-ed-sidebar]');
  const interactButton = $<HTMLButtonElement>('[data-ed-interact]');
  const tabs = [...ui.querySelectorAll<HTMLButtonElement>('[data-ed-tab]')];
  const panels = [...ui.querySelectorAll<HTMLElement>('[data-ed-panel]')];
  const inspector = $('[data-ed-inspector]');
  const targetBox = $('[data-ed-target]');
  const tree = $('[data-ed-tree]');
  const spacingPanel = $('[data-ed-spacing]');
  const hint = $('[data-ed-hint]');
  const hintText = $('[data-ed-hint-text]');
  const statusEl = $('[data-ed-status]');
  const saveButton = $<HTMLButtonElement>('[data-ed-save]');
  const discardButton = $<HTMLButtonElement>('[data-ed-discard]');
  const hoverBox = $('[data-ed-hover]');
  const selectBox = $('[data-ed-select]');
  const spacingOverlay = $('[data-ed-spacing-overlay]');
  const marginBox = $('[data-ed-margin]');
  const paddingBox = $('[data-ed-padding]');
  const icons = $<HTMLTemplateElement>('template[data-ed-icons]');

  const texts = createTexts();
  const styles = createStyles();
  const media = createMedia(ui);

  let editing = false;
  let tab: Tab = 'inspect';
  let selected: Element | null = null;
  let selectedBlock: string | null = null;
  let hovered: Element | null = null;
  let insertTarget: InsertTarget | null = null;
  let interact = false;
  let note = '';
  const expanded = new Set<Element>();
  const mobile = () => matchMedia('(max-width: 47.99rem)').matches;

  const blocks = createBlockEditor(ui, {
    onChange: () => afterBlocksChange(),
    shrink,
    status: (message) => setNote(message),
    select: (id) => selectBlock(id),
    openInsert: (target) => {
      insertTarget = target;
      showTab('insert');
    },
    takeTarget: () => {
      const target = insertTarget;
      insertTarget = null;
      renderTarget();
      return target;
    },
    placing: (label, moving) => {
      hint.hidden = !label;
      if (label) hintText.textContent = `„${label}“ ${moving ? 'verschieben' : 'einfügen'}: Stelle auf der Seite anklicken – Esc bricht ab.`;
      // Auf dem Handy die Leiste klein machen, damit die Seite frei ist
      if (mobile()) sidebar.dataset.size = label ? 'min' : 'half';
    },
  });

  /* ---------------- Hilfen ---------------- */
  const icon = (name: string) => {
    const found = icons.content.querySelector(`[data-icon="${name}"]`) ?? icons.content.querySelector('[data-icon="box"]');
    return (found?.cloneNode(true) as HTMLElement) ?? h('span');
  };

  const blockId = (el: Element) => (el.matches('[data-ub]') ? (el as HTMLElement).dataset.ub! : null);
  const labelFor = (el: Element) => {
    const id = blockId(el);
    return (id && blocks.info(id)?.label) || nameOf(el);
  };

  /** Aktuell ausgewähltes Element (Elemente aus dem Baukasten werden nach jeder Änderung neu gezeichnet) */
  const current = (): Element | null => (selectedBlock ? blocks.element(selectedBlock) : selected?.isConnected ? selected : null);

  const button = (label: string, onClick: () => void, opts: { icon?: string; title?: string; cls?: string; disabled?: boolean } = {}) => {
    const b = h('button', { type: 'button', class: `ed-btn ${opts.cls ?? ''}`, title: opts.title, disabled: opts.disabled });
    if (opts.title) b.setAttribute('aria-label', opts.title);
    if (opts.icon) b.append(icon(opts.icon));
    if (label) b.append(h('span', {}, label));
    b.addEventListener('click', (event) => {
      event.preventDefault();
      onClick();
    });
    return b;
  };

  const setNote = (message: string) => {
    note = message;
    updateStatus();
  };

  /* ---------------- Status & Speichern ---------------- */
  const pendingParts = () => {
    const textCount = texts.changes().length;
    const styleCount = styles.count();
    return [
      ...(textCount ? [`${textCount} ${textCount === 1 ? 'Text' : 'Texte'}`] : []),
      ...(styleCount ? [`${styleCount} ${styleCount === 1 ? 'Gestaltung' : 'Gestaltungen'}`] : []),
      ...(blocks.dirty() ? ['Elemente'] : []),
    ];
  };
  const unsaved = () => pendingParts().length > 0;

  function updateStatus() {
    const parts = pendingParts();
    statusEl.textContent = parts.length ? `Geändert: ${parts.join(' · ')} – noch nicht gespeichert` : note || 'Alles gespeichert.';
    statusEl.classList.toggle('is-dirty', parts.length > 0);
    // Anzahl der Änderungen am Speichern-Knopf
    const count = texts.changes().length + styles.count() + (blocks.dirty() ? 1 : 0);
    saveButton.querySelector('.ed-count')?.remove();
    if (count) saveButton.append(h('span', { class: 'ed-count' }, String(count)));
    saveButton.disabled = parts.length === 0;
    discardButton.disabled = parts.length === 0;
  }

  saveButton.addEventListener('click', () => void saveAll());
  async function saveAll() {
    if (!unsaved()) return;
    saveButton.disabled = true;
    statusEl.textContent = 'Wird gespeichert …';
    try {
      await texts.save();
      await styles.save();
      if (blocks.dirty()) await blocks.save();
      note = SAVED;
    } catch (error) {
      note = error instanceof Error ? error.message : 'Speichern fehlgeschlagen.';
    }
    updateStatus();
    renderPanels();
  }

  discardButton.addEventListener('click', () => {
    if (!confirm('Alle ungespeicherten Änderungen verwerfen?')) return;
    texts.discard();
    styles.discard();
    blocks.discard();
    note = 'Änderungen verworfen.';
    if (selectedBlock && !blocks.element(selectedBlock)) selectedBlock = null;
    updateStatus();
    renderPanels();
  });

  /* ---------------- Reiter ---------------- */
  function showTab(next: Tab) {
    tab = next;
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.edTab === next)));
    panels.forEach((p) => (p.hidden = p.dataset.edPanel !== next));
    if (mobile() && sidebar.dataset.size === 'min') sidebar.dataset.size = 'half';
    renderPanels();
  }
  tabs.forEach((t) =>
    t.addEventListener('click', () => {
      setCollapsed(false);
      showTab(t.dataset.edTab as Tab);
    }),
  );

  /** Leiste zur schmalen Symbolleiste einklappen (nur ab Tablet-Breite) */
  function setCollapsed(on: boolean) {
    if (on && mobile()) return;
    sidebar.toggleAttribute('data-collapsed', on);
    document.documentElement.classList.toggle('ed-collapsed', on);
    fitPage();
  }

  /** Seite neben der Leiste proportional verkleinern – Layout bleibt wie in voller Breite */
  function fitPage() {
    const root = document.documentElement;
    if (!editing || mobile()) return root.style.removeProperty('--ed-zoom');
    const styles = getComputedStyle(root);
    const rem = parseFloat(styles.fontSize) || 16;
    const space = parseFloat(styles.getPropertyValue(sidebar.hasAttribute('data-collapsed') ? '--ed-rail' : '--ed-w')) * rem;
    const width = root.clientWidth;
    root.style.setProperty('--ed-zoom', String(Math.max(0.4, (width - space) / width)));
  }
  window.addEventListener('resize', () => fitPage());
  ui.querySelectorAll('[data-ed-collapse]').forEach((b) =>
    b.addEventListener('click', () => setCollapsed(!sidebar.hasAttribute('data-collapsed'))),
  );

  function renderPanels() {
    if (tab === 'inspect') renderInspector();
    if (tab === 'insert') renderTarget();
    if (tab === 'layers') renderTree();
    if (tab === 'spacing') renderSpacing();
  }

  /* ---------------- Auswahl ---------------- */
  function select(el: Element | null, { reveal = false } = {}) {
    const id = el ? blockId(el) : null;
    selectedBlock = id;
    selected = id ? null : el;
    if (tab === 'insert') showTab('inspect');
    else renderPanels();
    if (el && mobile() && sidebar.dataset.size === 'min') sidebar.dataset.size = 'half';
    if (el && reveal) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function selectBlock(id: string) {
    selectedBlock = id;
    selected = null;
    if (tab === 'insert') showTab('inspect');
    else renderPanels();
  }

  function afterBlocksChange() {
    updateStatus();
    if (selectedBlock && !blocks.element(selectedBlock)) {
      selectedBlock = null;
      renderPanels();
    } else if (tab === 'layers') renderTree();
  }

  let hoverLabel = '';
  const setHover = (el: Element | null) => {
    if (el === hovered) return;
    hovered = el;
    hoverLabel = el ? labelFor(el) : '';
  };

  /* ---------------- Inspektor ---------------- */
  function renderInspector() {
    const el = current();
    inspector.replaceChildren(el ? inspect(el) : emptyState());
  }

  function emptyState() {
    const step = (iconName: string, title: string, text: string, onClick?: () => void) => {
      const b = h('button', { type: 'button', class: 'ed-step' }, icon(iconName), h('span', {}, h('strong', {}, title), h('small', {}, text)));
      if (onClick) b.addEventListener('click', onClick);
      return b;
    };
    return h(
      'div',
      { class: 'ed-empty' },
      h('strong', {}, 'Element auf der Seite anklicken'),
      h('p', {}, 'Texte, Bilder, Karten, Abschnitte – alles ist auswählbar. Hier erscheinen dann die passenden Einstellungen.'),
      h(
        'div',
        { class: 'ed-steps' },
        step('type', 'Text anklicken', 'nur dieser Text – hier ändern'),
        step('square', 'Freie Fläche einer Karte', 'die ganze Karte mit allem darin'),
        step('square-plus', 'Einfügen', 'neue Elemente an jede Stelle, auch per Ziehen', () => showTab('insert')),
        step('layers', 'Ebenen', 'Aufbau der ganzen Seite', () => showTab('layers')),
        step('hand', 'Seite bedienen', 'Hand-Symbol unten oder Alt + Klick – z. B. Reiter wechseln'),
      ),
    );
  }

  function crumbs(el: Element) {
    const nav = h('nav', { class: 'ed-crumbs', 'aria-label': 'Pfad' });
    nav.append(button('Seite', () => select(null), { cls: 'ed-crumb' }));
    // Nur aussagekräftige Stufen – reine Hüllen (Bereich, Raster, Gruppe) erreicht man über „Übergeordnet“
    const chain = chainOf(el);
    const steps = chain.filter((node, i) => i === 0 || node === el || !['Bereich', 'Raster', 'Gruppe'].includes(labelFor(node))).slice(-5);
    for (const node of steps) {
      const b = button(labelFor(node), () => select(node, { reveal: true }), { cls: `ed-crumb${node === el ? ' is-current' : ''}` });
      b.addEventListener('pointerenter', () => setHover(node));
      b.addEventListener('pointerleave', () => setHover(null));
      nav.append(b);
    }
    return nav;
  }

  /** Pfad und ein Einstellungsbereich – Inhalt und Gestaltung je nach Elementart */
  function inspect(el: Element): HTMLElement {
    const wrap = h('div', { class: 'ed-inspect' }, crumbs(el));
    if (isGlobal(el)) wrap.append(h('p', { class: 'ed-note' }, 'Kopf- und Fußzeile: Änderungen gelten auf allen Seiten.'));
    const panel = h('div', { class: 'ed-panel' });
    const id = blockId(el);
    if (id && blocks.info(id)) blocks.renderInspector(id, panel);
    else {
      const content = [...textFields(el), ...contextTools(el)];
      if (content.length) panel.append(subsection('Inhalt', ...content));
      panel.append(...designSections(el, kindAt(el)));
    }
    wrap.append(panel);
    return wrap;
  }

  /** Texte eines Textelements – ein Feld je Teil (z. B. Text und gelbe Markierung) */
  function textFields(el: Element): HTMLElement[] {
    if (!isTextElement(el)) return [];
    const nodes = textNodes(el).filter((node) => texts.has(node));
    if (!nodes.length) return [h('p', { class: 'ed-note' }, 'Dieser Text wird automatisch erzeugt (z. B. Zähler) und lässt sich hier nicht ändern.')];
    const fields: HTMLElement[] = nodes.map((node) => {
      const owner = node.parentElement!;
      const label = owner === el ? 'Text' : nameOf(owner);
      const area = h('textarea', { rows: '1', spellcheck: 'true' });
      area.value = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      const fit = () => {
        area.style.setProperty('height', 'auto');
        area.style.setProperty('height', `${area.scrollHeight + 2}px`);
      };
      area.addEventListener('input', () => {
        texts.set(node, area.value);
        field.classList.toggle('is-changed', texts.changed(node));
        updateStatus();
        fit();
      });
      area.addEventListener('keydown', (event) => event.key === 'Enter' && event.preventDefault());
      requestAnimationFrame(fit);
      const field = h('label', { class: `ed-field${texts.changed(node) ? ' is-changed' : ''}` }, h('span', {}, label), area);
      return field;
    });
    if (nodes.length > 1) fields.push(h('p', { class: 'ed-note' }, 'Teile mit eigener Formatierung (z. B. gelbe Markierung) haben ein eigenes Feld.'));
    // Erstes Feld direkt bereit zum Tippen
    requestAnimationFrame(() => {
      if (tab === 'inspect' && !mobile()) inspector.querySelector('textarea')?.focus({ preventScroll: true });
    });
    return fields;
  }

  /** Inhalte je nach Bereich: Link-Ziel, Kopfbild, Galerie, Referenzprojekte, feste Bilder */
  function contextTools(el: Element): HTMLElement[] {
    const tools: HTMLElement[] = [];
    if (el.matches('a[href]')) {
      tools.push(
        h('div', { class: 'ed-field' }, h('span', {}, 'Link-Ziel'), h('p', { class: 'ed-code' }, el.getAttribute('href') ?? '')),
        h('p', { class: 'ed-note' }, 'Link-Ziele sind fest eingebaut.'),
      );
    }
    const hero = el.closest<HTMLElement>('[data-hero-edit]');
    if (hero && (el === hero || el.closest('.hero__bg, .page-hero__photo'))) {
      tools.push(button('Kopfbild ändern', () => media.openHero(hero), { icon: 'image', cls: 'ed-btn--primary ed-btn--block' }));
    }
    if (el.matches('[data-carousel][data-gallery]')) {
      const carousel = el as HTMLElement;
      tools.push(
        h('p', { class: 'ed-note' }, `${carousel.dataset.count ?? 0} Fotos · hinzufügen, sortieren, ausblenden`),
        button('Fotos bearbeiten', () => media.openGallery(carousel), { icon: 'images', cls: 'ed-btn--primary ed-btn--block' }),
      );
    }
    const card = el.closest<HTMLElement>('.service[data-service]');
    if (card && (el === card || el.closest('.service__projects'))) {
      tools.push(h('div', { class: 'ed-field' }, h('span', {}, 'Referenzprojekte'), projectsPanel(card, media.openGallery)));
    }
    if (!tools.length && el.matches('img, picture, figure') && !el.closest('[data-ub]')) {
      tools.push(h('p', { class: 'ed-note' }, 'Dieses Foto ist fest eingebaut. Kopfbilder und Galerien lassen sich hier tauschen.'));
    }
    return tools;
  }

  /* ---------------- Gestaltung ---------------- */
  const px = (value: string) => Math.round(parseFloat(value) || 0);

  /** Design, Schrift, Abstände, Form, Sichtbarkeit – nur die Einstellungen, die zur Elementart passen */
  function designSections(el: Element, kind: Kind): HTMLElement[] {
    const has = (control: Control) => kind.controls.includes(control);
    const sections: HTMLElement[] = [
      subsection(
        'Design',
        designToggle({
          mode: kind.design,
          value: styles.value(el, kind.design),
          onChange: (value) => {
            styles.set(el, kind.design, value || null);
            updateStatus();
          },
        }),
        has('bgColor') && colorControl(el, 'background-color', kind.name === 'Button' ? 'Button-Fläche' : 'Hintergrundfarbe'),
        has('textColor') && colorControl(el, 'color', kind.name === 'Symbol' ? 'Symbolfarbe' : 'Schriftfarbe'),
      ),
    ];
    if (has('fontSize') || has('fontWeight') || has('align')) {
      sections.push(
        subsection(
          'Schrift',
          has('fontSize') && sizeControl(el),
          has('fontWeight') &&
            segControl(el, 'font-weight', 'Stärke', [
              ['400', 'Normal'],
              ['600', 'Halbfett'],
              ['700', 'Fett'],
              ['800', 'Extra'],
            ]),
          has('align') && alignControl(el),
        ),
      );
    }
    sections.push(
      subsection(
        'Abstände',
        sidesControl(el, 'margin', 'Außen'),
        has('padding') && sidesControl(el, 'padding', 'Innen'),
        h('p', { class: 'ed-note' }, 'Werte in Pixel – leer = Standard der Seite.'),
      ),
    );
    if (has('radius') || has('maxWidth') || has('gap')) {
      sections.push(
        subsection(
          'Form',
          h(
            'div',
            { class: 'ed-row2' },
            has('radius') && numberControl(el, 'border-radius', 'Ecken'),
            has('maxWidth') && numberControl(el, 'max-width', 'Max. Breite'),
            has('gap') && numberControl(el, 'gap', 'Lücke'),
          ),
        ),
      );
    }
    if (has('hide')) {
      sections.push(
        subsection(
          'Sichtbarkeit',
          segControl(el, 'hide', 'Ausblenden', [
            ['mobile', 'Auf dem Handy ausblenden', 'smartphone'],
            ['desktop', 'Am Computer ausblenden', 'monitor'],
            ['all', 'Überall ausblenden', 'eye-off'],
          ]),
        ),
      );
    }
    if (styles.hasOwn(el)) {
      sections.push(
        h(
          'div',
          { class: 'ed-panel__foot' },
          button('Eigene Gestaltung entfernen', () => {
            styles.reset(el);
            updateStatus();
            renderPanels();
          }, { icon: 'rotate-ccw', cls: 'ed-btn--ghost ed-btn--block' }),
        ),
      );
    }
    return sections;
  }

  function colorControl(el: Element, prop: StyleProp, label: string) {
    const own = styles.value(el, prop);
    const input = h('input', { type: 'color' });
    input.value = own || toHex(getComputedStyle(el).getPropertyValue(prop));
    const code = h('code', {}, own ? own.toUpperCase() : 'Standard');
    const reset = button('', () => apply(null), { icon: 'rotate-ccw', title: 'Standard', cls: 'ed-btn--ghost' });
    const apply = (value: string | null) => {
      styles.set(el, prop, value);
      code.textContent = value ? value.toUpperCase() : 'Standard';
      if (!value) input.value = toHex(getComputedStyle(el).getPropertyValue(prop));
      updateStatus();
    };
    input.addEventListener('input', () => apply(input.value));
    const swatches = h('span', { class: 'ed-swatches' });
    const root = getComputedStyle(document.documentElement);
    for (const [name, value] of [
      ['Onyx', root.getPropertyValue('--onyx-950')],
      ['Gelb', root.getPropertyValue('--yellow-500')],
      ['Weiß', '#ffffff'],
      ['Hellgrau', root.getPropertyValue('--gray-50')],
      ['Grau', root.getPropertyValue('--gray-500')],
    ]) {
      const hex = toHex(value);
      const swatch = button('', () => {
        input.value = hex;
        apply(hex);
      }, { title: name, cls: 'ed-swatch' });
      swatch.style.setProperty('--swatch', hex);
      swatches.append(swatch);
    }
    return h('div', { class: 'ed-field' }, h('span', {}, label), h('div', { class: 'ed-color' }, input, code, swatches, reset));
  }

  function numberControl(el: Element, prop: StyleProp, label: string, unit = 'px') {
    const own = styles.value(el, prop);
    const input = h('input', { type: 'number', step: '1', min: '0', placeholder: String(px(getComputedStyle(el).getPropertyValue(prop))) });
    input.value = own ? String(parseFloat(own)) : '';
    input.addEventListener('input', () => {
      styles.set(el, prop, input.value === '' ? null : `${Math.max(0, Math.round(Number(input.value)))}${unit}`);
      updateStatus();
    });
    return h('label', { class: 'ed-field' }, h('span', {}, label), h('span', { class: 'ed-unit' }, input, unit));
  }

  function alignControl(el: Element) {
    const own = styles.value(el, 'text-align');
    const bar = h('div', { class: 'ed-seg' });
    for (const [value, iconName, title] of [
      ['left', 'align-left', 'Links'],
      ['center', 'align-center', 'Mitte'],
      ['right', 'align-right', 'Rechts'],
      ['justify', 'align-justify', 'Blocksatz'],
    ]) {
      const b = button('', () => {
        const next = styles.value(el, 'text-align') === value ? null : value;
        styles.set(el, 'text-align', next);
        bar.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b && Boolean(next))));
        updateStatus();
      }, { icon: iconName, title });
      b.setAttribute('aria-pressed', String(own === value));
      bar.append(b);
    }
    return h('div', { class: 'ed-field' }, h('span', {}, 'Ausrichtung'), bar);
  }

  /** Umschalter aus Knöpfen (mit Symbol oder Text) – erneuter Klick auf den aktiven = Standard */
  function segControl(el: Element, prop: StyleProp, label: string, options: [string, string, string?][]) {
    const bar = h('div', { class: 'ed-seg' });
    const sync = () => {
      const own = styles.value(el, prop);
      bar.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === own)));
    };
    for (const [value, text, iconName] of options) {
      const b = button(iconName ? '' : text, () => {
        styles.set(el, prop, value && styles.value(el, prop) !== value ? value : null);
        sync();
        updateStatus();
        if (tab === 'layers') renderTree();
      }, { icon: iconName, title: text });
      b.dataset.value = value;
      bar.append(b);
    }
    sync();
    return h('div', { class: 'ed-field' }, h('span', {}, label), bar);
  }

  /** Schriftgröße: Schieberegler und Zahlenfeld */
  function sizeControl(el: Element) {
    const own = styles.value(el, 'font-size');
    const current = px(getComputedStyle(el).fontSize);
    const range = h('input', { type: 'range', min: '10', max: '96', step: '1' });
    const number = h('input', { type: 'number', min: '8', max: '160', step: '1', placeholder: String(current) });
    range.value = String(own ? parseFloat(own) : current);
    number.value = own ? String(parseFloat(own)) : '';
    const apply = (value: string) => {
      styles.set(el, 'font-size', value === '' ? null : `${Math.round(Number(value))}px`);
      updateStatus();
    };
    range.addEventListener('input', () => {
      number.value = range.value;
      apply(range.value);
    });
    number.addEventListener('input', () => {
      if (number.value !== '') range.value = number.value;
      apply(number.value);
    });
    return h('div', { class: 'ed-field' }, h('span', {}, 'Größe'), h('div', { class: 'ed-range' }, range, h('span', { class: 'ed-unit' }, number, 'px')));
  }

  /** Abstände je Seite (oben, rechts, unten, links) – Platzhalter zeigen die aktuellen Werte */
  function sidesControl(el: Element, kind: 'margin' | 'padding', label: string) {
    const cs = getComputedStyle(el);
    const grid = h('div', { class: 'ed-sides' });
    for (const side of SIDES) {
      const prop = `${kind}-${side}` as StyleProp;
      const own = styles.value(el, prop);
      const input = h('input', { type: 'number', step: '1', min: kind === 'padding' ? '0' : undefined, placeholder: String(px(cs.getPropertyValue(prop))), 'aria-label': `${label} ${SIDE_LABELS[side]}` });
      input.value = own ? String(parseFloat(own)) : '';
      input.addEventListener('input', () => {
        styles.set(el, prop, input.value === '' ? null : `${Math.round(Number(input.value))}px`);
        updateStatus();
      });
      grid.append(h('label', {}, h('small', {}, SIDE_LABELS[side]), input));
    }
    return h('div', { class: 'ed-field' }, h('span', {}, label), grid);
  }

  /* ---------------- Einfügen ---------------- */
  function renderTarget() {
    targetBox.replaceChildren();
    if (insertTarget) {
      targetBox.append(
        h('div', { class: 'ed-target is-set' }, icon('crosshair'), h('span', {}, h('small', {}, 'Einfügen'), h('strong', {}, insertTarget.label)), button('', () => {
          insertTarget = null;
          renderTarget();
        }, { icon: 'x', title: 'Stelle aufheben', cls: 'ed-btn--ghost' })),
      );
      blocks.showLibraryTab(insertTarget.target.startsWith('zone:') ? 'vorlagen' : 'basis');
    } else {
      targetBox.append(
        h(
          'div',
          { class: 'ed-target' },
          icon('hand'),
          h('span', {}, h('strong', {}, 'Auf die Seite ziehen'), h('small', {}, 'oder antippen und dann die Stelle anklicken. Genaue Stelle: Element auswählen → „+“ davor oder dahinter.')),
        ),
      );
    }
  }

  /* ---------------- Ebenen ---------------- */
  function nodeRow(el: Element) {
    const name = labelFor(el);
    const hidden = (el as HTMLElement).dataset?.edHide || styles.value(el, 'hide');
    const row = h(
      'button',
      { type: 'button', class: `ed-node${el === current() ? ' is-current' : ''}` },
      icon(blockId(el) ? 'blocks' : kindAt(el).icon),
      h('span', { class: 'ed-node__name' }, name),
      h('span', { class: 'ed-node__text' }, snippetOf(el)),
      hidden ? h('span', { class: 'ed-badge' }, 'ausgeblendet') : null,
    );
    row.addEventListener('pointerenter', () => setHover(el));
    row.addEventListener('pointerleave', () => setHover(null));
    return row;
  }

  function renderTree() {
    for (const el of expanded) if (!el.isConnected) expanded.delete(el);
    const cur = current();
    if (cur) chainOf(cur).slice(0, -1).forEach((el) => expanded.add(el));
    const roots = [document.querySelector('.site-header'), ...childItems(main!), document.querySelector('.site-footer')].filter(Boolean) as Element[];
    const rows: HTMLElement[] = [];
    const add = (el: Element, depth: number) => {
      const kids = childItems(el);
      const open = expanded.has(el);
      const twisty = kids.length
        ? button('', () => {
            if (open) expanded.delete(el);
            else expanded.add(el);
            renderTree();
          }, { icon: 'chevron-right', title: open ? 'Zuklappen' : 'Aufklappen', cls: `ed-twisty${open ? ' is-open' : ''}` })
        : h('span', { class: 'ed-twisty' });
      const row = nodeRow(el);
      row.addEventListener('click', () => {
        select(el, { reveal: true });
        if (kids.length && !open) {
          expanded.add(el);
          renderTree();
        }
      });
      row.addEventListener('dblclick', () => showTab('inspect'));
      const line = h('div', { class: 'ed-tree__line' }, twisty, row);
      line.style.setProperty('--depth', String(depth));
      if (el === cur) line.append(button('', () => showTab('inspect'), { icon: 'sliders-horizontal', title: 'Einstellungen', cls: 'ed-btn--ghost' }));
      rows.push(line);
      if (open) kids.forEach((kid) => add(kid, depth + 1));
    };
    roots.forEach((el) => add(el, 0));
    tree.replaceChildren(...rows);
    tree.querySelector('.is-current')?.scrollIntoView({ block: 'nearest' });
  }

  /* ---------------- Abstände ---------------- */
  function renderSpacing() {
    const el = current();
    spacingPanel.replaceChildren(
      h('p', { class: 'ed-note' }, 'Fahren Sie über die Seite: Außenabstand orange, Innenabstand blau. Klick wählt das Element.'),
    );
    if (!el) return;
    spacingPanel.append(h('p', { class: 'ed-spacing__name' }, labelFor(el)));
    if (blockId(el)) {
      spacingPanel.append(
        h('p', { class: 'ed-note' }, 'Abstände von Elementen aus dem Baukasten stehen in deren Einstellungen unter „Abstände“.'),
        button('Zu den Einstellungen', () => showTab('inspect'), { icon: 'sliders-horizontal', cls: 'ed-btn--block' }),
      );
      return;
    }
    const panel = h('div', { class: 'ed-panel ed-panel--plain' });
    panel.append(sidesControl(el, 'margin', 'Außen'));
    if (kindAt(el).controls.includes('padding')) panel.append(sidesControl(el, 'padding', 'Innen'));
    panel.append(h('p', { class: 'ed-note' }, 'Werte in Pixel – leer = Standard der Seite.'));
    spacingPanel.append(panel);
  }

  /* ---------------- Markierungen auf der Seite ---------------- */
  const place = (box: HTMLElement, el: Element | null, label?: string) => {
    const r = el?.getBoundingClientRect();
    if (!el || !r || (!r.width && !r.height)) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    box.style.setProperty('transform', `translate(${Math.round(r.left)}px, ${Math.round(r.top)}px)`);
    box.style.setProperty('width', `${Math.round(r.width)}px`);
    box.style.setProperty('height', `${Math.round(r.height)}px`);
    const tag = box.querySelector<HTMLElement>('.ed-box__tag');
    if (tag && label !== undefined && tag.textContent !== label) tag.textContent = label;
    box.toggleAttribute('data-below', r.top < 70);
  };

  const drawSpacing = (el: Element | null) => {
    if (!el) {
      spacingOverlay.hidden = true;
      return;
    }
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const m = SIDES.map((side) => Math.max(0, px(cs.getPropertyValue(`margin-${side}`))));
    const p = SIDES.map((side) => px(cs.getPropertyValue(`padding-${side}`)));
    const b = SIDES.map((side) => px(cs.getPropertyValue(`border-${side}-width`)));
    const set = (box: HTMLElement, left: number, top: number, width: number, height: number, widths: number[]) => {
      box.style.setProperty('transform', `translate(${Math.round(left)}px, ${Math.round(top)}px)`);
      box.style.setProperty('width', `${Math.max(0, Math.round(width))}px`);
      box.style.setProperty('height', `${Math.max(0, Math.round(height))}px`);
      box.style.setProperty('border-width', widths.map((w) => `${Math.max(0, w)}px`).join(' '));
    };
    set(marginBox, r.left - m[3], r.top - m[0], r.width + m[1] + m[3], r.height + m[0] + m[2], m);
    set(paddingBox, r.left + b[3], r.top + b[0], r.width - b[1] - b[3], r.height - b[0] - b[2], p);
    spacingOverlay.hidden = false;
  };

  /* Werkzeugleiste und „+“-Punkte am gewählten Element */
  const quick = (name: string) => selectBox.querySelector<HTMLButtonElement>(`[data-ed-quick="${name}"]`)!;
  const plus = (position: 'before' | 'after') => selectBox.querySelector<HTMLButtonElement>(`[data-ed-plus="${position}"]`)!;
  let plusTargets: Partial<Record<'before' | 'after', InsertTarget>> = {};

  const updateSelectTools = (el: Element | null) => {
    plusTargets = {};
    if (!el) return;
    const id = blockId(el);
    const info = id ? blocks.info(id) : null;
    quick('parent').hidden = !parentOf(el);
    for (const name of ['up', 'down', 'move', 'duplicate', 'delete']) quick(name).hidden = !info;
    quick('up').disabled = !info?.canUp;
    quick('down').disabled = !info?.canDown;
    quick('perform').hidden = Boolean(info) || !el.matches('button, summary, [role="tab"]');
    const name = labelFor(el);
    for (const position of ['before', 'after'] as const) {
      const target = blocks.isReady() ? blocks.targetFor(el, position) : null;
      if (target) plusTargets[position] = { ...target, label: `${position === 'before' ? 'davor' : 'dahinter'} – „${name}“` };
      plus(position).hidden = !target;
    }
    selectBox.dataset.axis = axisOf(el);
  };

  quick('parent').addEventListener('click', () => {
    const el = current();
    const parent = el && parentOf(el);
    if (parent) select(parent);
  });
  quick('up').addEventListener('click', () => selectedBlock && blocks.moveBy(selectedBlock, -1));
  quick('down').addEventListener('click', () => selectedBlock && blocks.moveBy(selectedBlock, 1));
  // Verschieben: Knopf ziehen (Maus) oder anklicken und danach die Stelle wählen
  quick('move').addEventListener('pointerdown', (event) => selectedBlock && blocks.startMove(selectedBlock, event));
  quick('move').addEventListener('click', () => selectedBlock && blocks.startMove(selectedBlock));
  quick('duplicate').addEventListener('click', () => selectedBlock && blocks.duplicate(selectedBlock));
  quick('perform').addEventListener('click', () => {
    const el = current();
    if (el) perform(el);
  });
  quick('delete').addEventListener('click', () => {
    if (!selectedBlock) return;
    const next = blocks.remove(selectedBlock);
    if (next !== selectedBlock) select(next ? blocks.element(next) : null);
  });
  for (const position of ['before', 'after'] as const) {
    plus(position).addEventListener('click', () => {
      const target = plusTargets[position];
      if (!target) return;
      setCollapsed(false);
      insertTarget = target;
      showTab('insert');
    });
  }

  let selectLabel = '';
  let selectFor: Element | null = null;
  const frame = () => {
    if (!editing) return;
    const cur = current();
    if (cur !== selectFor) {
      selectFor = cur;
      selectLabel = cur ? labelFor(cur) : '';
      updateSelectTools(cur);
    }
    const quiet = interact || blocks.isPlacing();
    place(hoverBox, !quiet && hovered && hovered !== cur ? hovered : null, hoverLabel);
    place(selectBox, cur, selectLabel);
    drawSpacing(tab === 'spacing' && !quiet ? (hovered ?? cur) : null);
    requestAnimationFrame(frame);
  };

  /* ---------------- Ereignisse auf der Seite ---------------- */
  const passThrough = (event: MouseEvent) => interact || event.altKey;

  document.addEventListener(
    'pointermove',
    (event) => {
      if (!editing || event.pointerType !== 'mouse' || blocks.isPlacing()) return;
      const target = event.target as Element;
      if (isUi(target)) return;
      setHover(passThrough(event) ? null : pickTarget(target));
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => setHover(null));

  // Klick wählt aus (Links, Buttons, Formulare lösen nicht aus) – außer beim Bedienen der Seite
  document.addEventListener(
    'click',
    (event) => {
      if (!editing) return;
      const target = event.target as Element;
      if (isUi(target) || passThrough(event) || performing) return;
      event.preventDefault();
      event.stopPropagation();
      select(pickTarget(target));
    },
    true,
  );
  document.addEventListener(
    'mousedown',
    (event) => {
      // Kein Textcursor und kein Fokus in Formularfeldern der Seite beim Auswählen
      if (editing && !passThrough(event) && !isUi(event.target as Element)) event.preventDefault();
    },
    true,
  );
  document.addEventListener(
    'submit',
    (event) => {
      if (editing && !isUi(event.target as Element)) event.preventDefault();
    },
    true,
  );

  let performing = false;
  /** Klick auf der Seite auslösen (Reiter wechseln, aufklappen …) */
  function perform(el: Element) {
    performing = true;
    (el as HTMLElement).click();
    performing = false;
    requestAnimationFrame(() => renderPanels());
  }

  document.addEventListener('keydown', (event) => {
    if (!editing) return;
    const target = event.target as HTMLElement;
    const typing = target.matches('input, textarea, select') || target.isContentEditable;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void saveAll();
      return;
    }
    if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    if (typing) target.blur();
    else if (insertTarget) {
      insertTarget = null;
      renderTarget();
    } else if (current()) select(null);
  });

  window.addEventListener('beforeunload', (event) => {
    if (editing && unsaved()) event.preventDefault();
  });

  interactButton.addEventListener('click', () => {
    interact = !interact;
    interactButton.setAttribute('aria-pressed', String(interact));
    document.documentElement.classList.toggle('ed-interact', interact);
    setHover(null);
    setNote(interact ? 'Seite bedienen: Klicks wirken normal (Reiter, Galerien …). Zum Auswählen das Hand-Symbol wieder ausschalten.' : '');
  });

  $('[data-ed-sheet]').addEventListener('click', () => {
    sidebar.dataset.size = sidebar.dataset.size === 'full' ? 'half' : 'full';
  });
  $('[data-ed-hint-cancel]').addEventListener('click', () => blocks.cancelPlacing());

  /* ---------------- Start & Ende ---------------- */
  async function start() {
    editing = true;
    document.documentElement.classList.add('is-editing');
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-revealed'));
    texts.collect();
    toggle.hidden = true;
    sidebar.hidden = false;
    sidebar.dataset.size = 'half';
    fitPage();
    note = '';
    selected = null;
    selectedBlock = null;
    showTab('inspect');
    updateStatus();
    requestAnimationFrame(frame);
    await Promise.all([styles.load(), blocks.start()]);
    if (!note.includes('nicht')) note = '';
    updateStatus();
    renderPanels();
  }

  function stop() {
    if (unsaved() && !confirm('Es gibt ungespeicherte Änderungen. Trotzdem beenden (sie bleiben nur bis zum Neuladen sichtbar)?')) return;
    editing = false;
    blocks.stop();
    if (interact) interactButton.click();
    document.documentElement.classList.remove('is-editing');
    fitPage();
    sidebar.hidden = true;
    toggle.hidden = false;
    setHover(null);
    selected = null;
    selectedBlock = null;
    [hoverBox, selectBox, spacingOverlay].forEach((box) => (box.hidden = true));
  }

  toggle.addEventListener('click', () => void start());
  $('[data-ed-close]').addEventListener('click', stop);
}

/** Farbe aus getComputedStyle → #rrggbb */
function toHex(color: string) {
  const v = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  const probe = document.createElement('span');
  probe.style.color = v;
  document.body.append(probe);
  const rgb = getComputedStyle(probe).color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
  probe.remove();
  return `#${rgb.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;
}
