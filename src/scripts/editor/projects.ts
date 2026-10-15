/**
 * Bearbeiten-Modus – Referenzprojekte einer Leistungskarte (src/components/ui/ServiceCard.astro).
 * Zeigt die Projekte der Karte (Galerie bearbeiten) und legt neue an:
 *   Fotos → src/assets/images/referenzen/<slug>/01.jpg … (PUT /api/edit/bild/)
 *   Projekt → src/content/referenzen/<slug>.md mit `leistungen: [<Karte>]` (POST /api/edit/projekt/)
 *   Löschen → Projekt samt Fotos und Galerie-Eintrag (DELETE /api/edit/projekt/), nach Rückfrage
 * Das neue Projekt erscheint nach dem automatischen Build in der Karte.
 */
import { h } from './dom';
import { shrink, uploadImage } from './media';
import { publishEdits } from './publish';

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');

export function projectsPanel(card: HTMLElement, openGallery: (carousel: HTMLElement) => void): HTMLElement {
  const service = card.dataset.service ?? '';
  const pillar = card.dataset.pillar ?? '';
  const wrap = h('div', { class: 'ed-projects' });

  // Vorhandene Projekte der Karte
  const panels = [...card.querySelectorAll<HTMLElement>('[data-project-panel]')];
  const list = h('ul', { class: 'ed-projects__list', role: 'list' });
  for (const panel of panels) {
    const carousel = panel.querySelector<HTMLElement>('[data-carousel][data-gallery]');
    const count = carousel?.dataset.count ?? '0';
    const button = h('button', { type: 'button', class: 'ed-btn ed-btn--small' }, 'Fotos');
    button.addEventListener('click', () => carousel && openGallery(carousel));
    const info = h('small', {}, `${count} Fotos`);
    const remove = h('button', { type: 'button', class: 'ed-btn ed-btn--small ed-btn--danger' }, 'Löschen');
    remove.addEventListener('click', () => void deleteProject(panel, info, [button, remove]));
    list.append(h('li', {}, h('span', {}, h('strong', {}, panel.dataset.title ?? 'Projekt'), info), carousel ? button : null, panel.dataset.project ? remove : null));
  }

  async function deleteProject(panel: HTMLElement, info: HTMLElement, buttons: HTMLButtonElement[]) {
    const name = panel.dataset.title ?? 'dieses Projekt';
    if (!confirm(`„${name}“ mit allen Fotos löschen?\n\nDas Projekt verschwindet aus allen Leistungen, in denen es vorkommt.`)) return;
    for (const button of buttons) button.disabled = true;
    info.textContent = 'Wird gelöscht …';
    try {
      const response = await fetch('/api/edit/projekt/', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: panel.dataset.project }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Löschen fehlgeschlagen.');
      await publishEdits();
      info.textContent = result.photosKept
        ? 'gelöscht · Fotos bleiben (werden noch woanders genutzt) · nach dem Build weg'
        : 'gelöscht · nach dem Build (ca. 2 Minuten) weg';
      for (const button of buttons) button.remove();
    } catch (error) {
      info.textContent = error instanceof Error ? error.message : 'Löschen fehlgeschlagen.';
      for (const button of buttons) button.disabled = false;
    }
  }
  if (!panels.length) list.append(h('li', { class: 'ed-muted' }, 'Noch keine Projekte in dieser Karte.'));
  wrap.append(list);

  // Neues Projekt
  const toggle = h('button', { type: 'button', class: 'ed-btn ed-btn--primary ed-btn--block' }, '+ Neues Projekt mit Galerie anlegen');
  const form = h('form', { class: 'ed-form', hidden: true });
  const title = h('input', { type: 'text', maxlength: '120', required: true, placeholder: 'z. B. Hofeinfahrt in Singen' });
  const summary = h('textarea', { rows: '3', maxlength: '500', required: true, placeholder: 'Ein, zwei Sätze zum Projekt' });
  const place = h('input', { type: 'text', maxlength: '80', placeholder: 'optional' });
  const year = h('input', { type: 'number', min: '1950', max: '2100', placeholder: 'optional' });
  const files = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic', multiple: true });
  const thumbs = h('div', { class: 'ed-thumbs' });
  const status = h('p', { class: 'ed-form__status', 'aria-live': 'polite' });
  const submit = h('button', { type: 'submit', class: 'ed-btn ed-btn--primary ed-btn--block' }, 'Projekt anlegen');
  const field = (label: string, control: HTMLElement) => h('label', { class: 'ed-field' }, h('span', {}, label), control);
  form.append(
    field('Titel', title),
    field('Kurzbeschreibung', summary),
    h('div', { class: 'ed-row2' }, field('Ort', place), field('Jahr', year)),
    h('label', { class: 'ed-upload' }, files, 'Fotos auswählen – das erste wird das Titelbild'),
    thumbs,
    submit,
    status,
  );
  wrap.append(toggle, form);

  toggle.addEventListener('click', () => {
    form.hidden = !form.hidden;
    toggle.textContent = form.hidden ? '+ Neues Projekt mit Galerie anlegen' : 'Abbrechen';
    if (!form.hidden) title.focus();
  });

  files.addEventListener('change', () => {
    thumbs.replaceChildren(...[...(files.files ?? [])].map((file) => h('img', { src: URL.createObjectURL(file), alt: file.name })));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const photos = [...(files.files ?? [])];
    if (!title.value.trim() || !summary.value.trim()) return void (status.textContent = 'Bitte Titel und Kurzbeschreibung angeben.');
    if (!photos.length) return void (status.textContent = 'Bitte mindestens ein Foto auswählen.');
    const slug = `${slugify(title.value) || 'projekt'}-${Date.now().toString(36).slice(-4)}`;
    submit.disabled = true;
    try {
      for (const [index, file] of photos.entries()) {
        status.textContent = `Lade Foto ${index + 1} von ${photos.length} hoch …`;
        await uploadImage(`referenzen/${slug}`, `${String(index + 1).padStart(2, '0')}.jpg`, await shrink(file));
      }
      status.textContent = 'Projekt wird angelegt …';
      const response = await fetch('/api/edit/projekt/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, service, pillar, title: title.value, summary: summary.value, location: place.value, year: year.value }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Projekt konnte nicht angelegt werden.');
      await publishEdits();
      list.querySelector('.ed-muted')?.remove();
      list.append(h('li', {}, h('span', {}, h('strong', {}, title.value), h('small', {}, `neu · ${photos.length} Fotos · nach dem Build sichtbar`))));
      form.reset();
      thumbs.replaceChildren();
      form.hidden = true;
      toggle.textContent = '+ Weiteres Projekt anlegen';
      status.textContent = '';
      wrap.append(h('p', { class: 'ed-note ed-note--ok' }, 'Projekt angelegt – erscheint nach dem automatischen Build (ca. 2 Minuten) in dieser Karte.'));
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Projekt konnte nicht angelegt werden.';
    } finally {
      submit.disabled = false;
    }
  });

  return wrap;
}
