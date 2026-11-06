import {
  myoStep,
  parseChooserState,
  projectsFilterHref,
  reasonLabels,
  recommendProjects,
  serializeChooserState,
  type ChooserProject,
  type ChooserState,
} from '../lib/chooser';
import { localePath } from '../lib/routes';
import type { Lang } from '../lib/routes';

const dataElement = document.getElementById('chooser-data');
const form = document.querySelector<HTMLFormElement>('[data-chooser]');
const region = document.querySelector<HTMLElement>('[data-results-region]');
const list = document.querySelector<HTMLOListElement>('[data-results]');
const empty = document.querySelector<HTMLElement>('[data-results-empty]');
const title = document.querySelector<HTMLElement>('[data-results-title]');
const status = document.querySelector<HTMLElement>('[data-results-status]');
const template = document.querySelector<HTMLTemplateElement>('[data-result-template]');

if (dataElement && form && region && list && empty && title && status && template) {
  const projects = JSON.parse(dataElement.textContent ?? '[]') as ChooserProject[];
  const lang: Lang = document.documentElement.lang === 'fr' ? 'fr' : 'en';
  const projectsBase = dataElement.dataset.projectsBase ?? localePath(lang, '/projects/');
  const myoBase = dataElement.dataset.myoBase ?? localePath(lang, '/myo/');
  let complete = parseChooserState(window.location.search) !== null;

  const readState = (): ChooserState | null => {
    const values = new FormData(form);
    const params = new URLSearchParams();
    for (const key of ['goal', 'platform', 'level']) {
      const value = values.get(key);
      if (typeof value === 'string' && value) params.set(key, value);
    }
    return parseChooserState(params.toString());
  };

  const syncForm = (state: ChooserState) => {
    for (const [name, value] of Object.entries(state)) {
      const input = form.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);
      if (input) input.checked = true;
    }
  };

  const render = (state: ChooserState | null, moveFocus = false) => {
    if (!state) {
      region.hidden = true;
      return;
    }

    const recommendations = recommendProjects(projects, state);
    const items = recommendations.flatMap((rec, index) => {
      const item = template.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
      if (!item) return [];

      const link = item.querySelector<HTMLAnchorElement>('[data-link]');
      if (link) {
        link.href = localePath(lang, `/p/${rec.project.slug}/`);
        link.textContent = rec.project.name;
      }

      const rank = item.querySelector<HTMLElement>('[data-rank]');
      if (rank) {
        rank.textContent =
          index === 0 ? (template.dataset.labelBest ?? '') : (template.dataset.labelAlt ?? '');
      }

      const description = item.querySelector<HTMLElement>('[data-description]');
      if (description) description.textContent = rec.project.description;

      const status = item.querySelector<HTMLElement>('[data-status]');
      if (status) {
        status.textContent = rec.project.statusLabel ?? '';
        status.hidden = rec.project.status === 'active';
      }

      const reasons = item.querySelector<HTMLElement>('[data-reasons]');
      if (reasons) {
        reasons.replaceChildren(
          ...reasonLabels(rec, state, lang).map((reason) => {
            const entry = document.createElement('li');
            entry.textContent = reason;
            return entry;
          }),
        );
      }

      const projectLink = item.querySelector<HTMLAnchorElement>('[data-link-project]');
      if (projectLink) {
        projectLink.href = localePath(lang, `/p/${rec.project.slug}/`);
        projectLink.textContent = template.dataset.labelProject ?? '';
      }

      const myoLink = item.querySelector<HTMLAnchorElement>('[data-link-myo]');
      const step = myoStep(state.goal);
      if (myoLink) {
        myoLink.hidden = step === undefined;
        if (step !== undefined) {
          myoLink.href = `${myoBase}#step-${step}`;
          myoLink.textContent = template.dataset.labelMyo ?? '';
        }
      }

      const filtersLink = item.querySelector<HTMLAnchorElement>('[data-link-filters]');
      if (filtersLink) {
        filtersLink.href = projectsFilterHref(state, projectsBase);
        filtersLink.textContent = template.dataset.labelFilters ?? '';
      }

      return [item];
    });

    list.replaceChildren(...items);
    list.hidden = items.length === 0;
    empty.hidden = items.length > 0;
    region.hidden = false;

    if (status) {
      if (recommendations.length === 0) {
        status.textContent = empty.textContent ?? '';
      } else {
        const count =
          recommendations.length === 1
            ? (template.dataset.labelCountOne ?? '')
            : (template.dataset.labelCountMany ?? '');
        const separator = lang === 'fr' ? ' : ' : ': ';
        status.textContent = `${recommendations.length} ${count}. ${
          template.dataset.labelBest ?? ''
        }${separator}${recommendations[0]?.project.name ?? ''}`;
      }
    }

    const query = serializeChooserState(state);
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}?${query}${window.location.hash}`,
    );

    if (moveFocus) title.focus();
  };

  const initial = parseChooserState(window.location.search);
  if (initial) syncForm(initial);
  render(initial);

  form.addEventListener('change', () => {
    const state = readState();
    const becameComplete = !complete && state !== null;
    complete = state !== null;
    render(state, becameComplete);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const state = readState();
    complete = state !== null;
    render(state, true);
  });
}
