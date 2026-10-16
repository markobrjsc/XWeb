/**
 * Projekt-Auswahl einer Leistungskarte (src/components/ui/ServiceCard.astro): Pfeile blättern im Kreis durch die
 * Projekte, Zähler und Beschriftung passen sich an. Erneut aufrufbar – der Bearbeiten-Modus nutzt das, wenn er in der
 * Vorschau Projekte hinzufügt oder entfernt (Projekte mit data-ed-deleted zählen dann nicht mit).
 */
export function initProjectSwitch(root: HTMLElement) {
  const all = [...root.querySelectorAll<HTMLElement>('[data-project-panel]')];
  const panels = all.filter((panel) => !panel.hasAttribute('data-ed-deleted'));
  const label = root.querySelector<HTMLElement>('[data-projects-label]');
  const count = root.querySelector<HTMLElement>('[data-project-count]');
  const switcher = root.querySelector<HTMLElement>('[data-project-switch]');
  const current = root.querySelector<HTMLElement>('[data-project-current]');
  const many = panels.length > 1;

  root.hidden = panels.length === 0;
  if (label) label.textContent = panels.length === 1 ? 'Referenzprojekt' : `${panels.length} Referenzprojekte`;
  if (count) count.hidden = !many;
  if (switcher) switcher.hidden = !many;
  // Knöpfe ersetzen – so hängen keine Klick-Handler eines früheren Aufrufs mehr daran
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-project-step]')].map((button) => {
    const fresh = button.cloneNode(true) as HTMLButtonElement;
    button.replaceWith(fresh);
    return fresh;
  });

  let index = 0;
  const titleAt = (i: number) => panels[(i + panels.length) % panels.length]?.dataset.title ?? '';

  const show = (next: number, animate = true) => {
    index = (next + panels.length) % Math.max(panels.length, 1);
    all.forEach((panel) => {
      const visible = panel === panels[index];
      panel.hidden = !visible;
      if (visible && animate) {
        panel.classList.remove('is-entering');
        void panel.offsetWidth;
        panel.classList.add('is-entering');
      }
    });
    if (current) {
      current.textContent = titleAt(index);
      current.title = titleAt(index);
    }
    if (count) count.textContent = `${index + 1} / ${panels.length}`;
    buttons.forEach((button) => {
      const step = Number(button.dataset.projectStep);
      const word = step < 0 ? 'Vorheriges' : 'Nächstes';
      button.dataset.tip = `${word}: ${titleAt(index + step)}`;
      button.setAttribute('aria-label', `${word} Projekt: ${titleAt(index + step)}`);
    });
  };

  buttons.forEach((button) => button.addEventListener('click', () => show(index + Number(button.dataset.projectStep))));
  show(0, false);
}
