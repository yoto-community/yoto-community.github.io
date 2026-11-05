const HIDDEN = new Set(['stale', 'archived', 'deprecated']);

const control = document.querySelector<HTMLElement>('[data-inactive-control]');
const toggle = document.querySelector<HTMLInputElement>('[data-inactive-toggle]');
const grid = document.querySelector<HTMLElement>('[data-inactive-grid]');
const count = document.querySelector<HTMLElement>('[data-count]');

if (control && toggle && grid) {
  const cards = [...grid.querySelectorAll<HTMLElement>('[data-project]')];
  const hasInactive = cards.some((card) => HIDDEN.has(card.dataset.status ?? ''));

  if (!hasInactive) {
    control.hidden = true;
  } else {
    control.hidden = false;
    let showInactive = new URLSearchParams(window.location.search).get('inactive') === '1';

    const apply = () => {
      let visible = 0;
      for (const card of cards) {
        const hidden = !showInactive && HIDDEN.has(card.dataset.status ?? '');
        card.hidden = hidden;
        if (!hidden) visible += 1;
      }

      if (count) {
        const label = visible === 1 ? count.dataset.one : count.dataset.many;
        count.textContent = `${visible} ${label ?? ''}`.trim();
      }

      const url = new URL(window.location.href);
      if (showInactive) url.searchParams.set('inactive', '1');
      else url.searchParams.delete('inactive');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      toggle.checked = showInactive;
    };

    toggle.addEventListener('change', () => {
      showInactive = toggle.checked;
      apply();
    });

    apply();
  }
}
