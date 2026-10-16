/**
 * Bearbeiten-Modus – Referenzprojekte einer Leistungskarte (src/components/ui/ServiceCard.astro).
 * Zeigt die Projekte der Karte (Galerie bearbeiten, löschen) und legt neue an. Beides wird nur vorgemerkt
 * (./pending.ts) und sofort in der Karte gezeigt (./preview.ts); mit „Speichern“:
 *   Fotos   → src/assets/images/referenzen/<slug>/01.jpg …
 *   Projekt → src/content/referenzen/<slug>.md mit `leistungen: [<Karte>]`
 *   Löschen → Projektdatei, Fotos und Galerie-Eintrag
 */
import { h } from './dom';
import { stageImage } from './media';
import { newId, pending } from './pending';
import { previewProjects } from './preview';

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

export function projectsPanel(card: HTMLElement, openGallery: (carousel: HTMLElement) => void, onChange: () => void): HTMLElement {
  const service = card.dataset.service ?? '';
  const pillar = card.dataset.pillar ?? '';
  const wrap = h('div', { class: 'ed-projects' });
  const list = h('ul', { class: 'ed-projects__list', role: 'list' });
  wrap.append(list);

  /** Vorschau auf der Seite und Liste neu aufbauen */
  const refresh = async () => {
    await previewProjects();
    onChange();
    renderList();
  };

  function renderList() {
    const panels = [...card.querySelectorAll<HTMLElement>('[data-project-panel]')];
    list.replaceChildren();
    for (const panel of panels) {
      const slug = panel.dataset.project ?? '';
      const deleted = panel.hasAttribute('data-ed-deleted');
      const isNew = panel.hasAttribute('data-ed-new');
      const carousel = panel.querySelector<HTMLElement>('[data-carousel][data-gallery]');
      const count = carousel?.dataset.count ?? '0';
      const info = h('small', {}, deleted ? 'wird beim Speichern gelöscht' : `${isNew ? 'neu · ' : ''}${count} Fotos`);
      const photos = h('button', { type: 'button', class: 'ed-btn ed-btn--small' }, 'Fotos');
      photos.addEventListener('click', () => carousel && openGallery(carousel));
      const remove = h('button', { type: 'button', class: `ed-btn ed-btn--small${deleted ? '' : ' ed-btn--danger'}` }, deleted ? 'Wiederherstellen' : 'Löschen');
      remove.addEventListener('click', () => {
        if (!deleted && !confirm(`„${panel.dataset.title ?? slug}“ mit allen Fotos löschen?\n\nDas Projekt verschwindet beim Speichern aus allen Leistungen, in denen es vorkommt.`)) return;
        pending.update((draft) => {
          if (deleted) draft.projects.deleted = draft.projects.deleted.filter((item) => item !== slug);
          else if (isNew) draft.projects.added = draft.projects.added.filter((item) => item.slug !== slug);
          else if (!draft.projects.deleted.includes(slug)) draft.projects.deleted.push(slug);
          if (!deleted) delete draft.galleries[`referenzen/${slug}`];
        });
        void refresh();
      });
      list.append(
        h(
          'li',
          { class: deleted ? 'is-deleted' : '' },
          h('span', {}, h('strong', {}, panel.dataset.title ?? 'Projekt'), info),
          carousel && !deleted ? photos : null,
          slug ? remove : null,
        ),
      );
    }
    if (!panels.length) list.append(h('li', { class: 'ed-muted' }, 'Noch keine Projekte in dieser Karte.'));
  }
  renderList();

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
  const submit = h('button', { type: 'submit', class: 'ed-btn ed-btn--primary ed-btn--block' }, 'Projekt vormerken');
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

  // Vorschaubilder als data:-Adresse – blob:-Adressen erlaubt die Content-Security-Policy nicht
  files.addEventListener('change', () => {
    thumbs.replaceChildren(
      ...[...(files.files ?? [])].map((file) => {
        const img = h('img', { alt: file.name });
        const reader = new FileReader();
        reader.onload = () => img.setAttribute('src', String(reader.result));
        reader.readAsDataURL(file);
        return img;
      }),
    );
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const photos = [...(files.files ?? [])];
    if (!title.value.trim() || !summary.value.trim()) return void (status.textContent = 'Bitte Titel und Kurzbeschreibung angeben.');
    if (!photos.length) return void (status.textContent = 'Bitte mindestens ein Foto auswählen.');
    const slug = `${slugify(title.value) || 'projekt'}-${newId().slice(-4)}`;
    submit.disabled = true;
    try {
      const names: string[] = [];
      for (const [index, file] of photos.entries()) {
        status.textContent = `Bereite Foto ${index + 1} von ${photos.length} vor …`;
        const name = `referenzen/${slug}/${String(index + 1).padStart(2, '0')}`;
        await stageImage(name, file);
        names.push(name);
      }
      pending.update((draft) => {
        draft.projects.added.push({
          slug,
          service,
          pillar,
          title: title.value.trim(),
          summary: summary.value.trim(),
          location: place.value.trim(),
          year: year.value.trim(),
          photos: names,
        });
      });
      form.reset();
      thumbs.replaceChildren();
      form.hidden = true;
      toggle.textContent = '+ Weiteres Projekt anlegen';
      status.textContent = '';
      await refresh();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Projekt konnte nicht vorbereitet werden.';
    } finally {
      submit.disabled = false;
    }
  });

  wrap.append(h('p', { class: 'ed-note' }, 'Neue und gelöschte Projekte sind vorgemerkt und erscheinen sofort in der Vorschau – übernommen werden sie mit „Speichern“.'));
  return wrap;
}
