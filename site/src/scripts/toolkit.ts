import { t } from '../i18n';
import { localePath, type Lang } from '../lib/routes';
import {
  LEGACY_TOOLKIT_KEYS,
  TOOLKIT_EVENT,
  TOOLKIT_KEY,
  TOOLKIT_TYPES,
  groupToolkitItems,
  hasItem,
  mergeToolkits,
  parseToolkitImport,
  readToolkit,
  removeItem,
  safeStorage,
  toggleItem,
  writeToolkit,
  type Toolkit,
  type ToolkitItem,
  type ToolkitItemType,
} from '../lib/toolkit';

const page = document.querySelector<HTMLElement>('[data-toolkit-page]');
const status = document.querySelector<HTMLElement>('[data-toolkit-status]');
const lang: Lang = document.documentElement.lang === 'fr' ? 'fr' : 'en';

let toolkit = readToolkit();

function isType(value: string | undefined): value is ToolkitItemType {
  return value !== undefined && (TOOLKIT_TYPES as readonly string[]).includes(value);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function showStatus(message: string, error = false): void {
  if (!status) return;
  status.textContent = message;
  status.dataset.state = error ? 'error' : 'ok';
  status.hidden = false;
}

function clearStatus(): void {
  if (!status) return;
  status.hidden = true;
  status.textContent = '';
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function syncButtons(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-toolkit-toggle]');
  for (const button of buttons) {
    const type = button.dataset.toolkitType;
    const id = button.dataset.toolkitId;
    if (!isType(type) || !id) continue;

    const pressed = hasItem(toolkit, type, id);
    const label = pressed ? button.dataset.labelRemove : button.dataset.labelAdd;
    const aria = pressed ? button.dataset.ariaRemove : button.dataset.ariaAdd;

    button.setAttribute('aria-pressed', String(pressed));
    if (aria) button.setAttribute('aria-label', aria);
    if (label) button.title = label;

    const text = button.querySelector<HTMLElement>('[data-toolkit-text]');
    if (text && label) text.textContent = label;
  }
}

function itemHref(item: ToolkitItem): string | null {
  if (item.type === 'project') return localePath(lang, `/p/${encodeURIComponent(item.id)}/`);
  if (item.type === 'icon') {
    return 'https://yoto-community.github.io/icons-catalogue/favorites';
  }
  return `https://yoto-community.github.io/podcast-catalogue/${
    lang === 'fr' ? 'fr/favoris' : 'en/favorites'
  }/`;
}

function itemRow(item: ToolkitItem): HTMLLIElement {
  const row = document.createElement('li');
  const body = document.createElement('div');
  const href = itemHref(item);

  const title = href ? document.createElement('a') : document.createElement('span');
  title.className = 'toolkit-item-title';
  title.textContent = item.title;
  if (title instanceof HTMLAnchorElement && href) title.href = href;

  const meta = document.createElement('span');
  meta.className = 'toolkit-item-meta';
  meta.textContent = `${t(lang, 'toolkit.added')} ${formatDate(item.addedAt)}`;
  body.append(title, meta);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'toolkit-remove';
  remove.dataset.toolkitRemove = '';
  remove.dataset.toolkitType = item.type;
  remove.dataset.toolkitId = item.id;
  remove.textContent = t(lang, 'toolkit.removeItem');
  remove.setAttribute('aria-label', `${t(lang, 'toolkit.remove')} — ${item.title}`);

  row.append(body, remove);
  return row;
}

function renderPage(): void {
  if (!page) return;

  const groups = groupToolkitItems(toolkit);
  for (const section of page.querySelectorAll<HTMLElement>('[data-toolkit-group]')) {
    const type = section.dataset.toolkitGroup;
    if (!isType(type)) {
      section.hidden = true;
      continue;
    }

    const items = groups[type];
    section.hidden = items.length === 0;

    const list = section.querySelector<HTMLUListElement>('[data-toolkit-items]');
    if (list) list.replaceChildren(...items.map(itemRow));
  }

  const empty = page.querySelector<HTMLElement>('[data-toolkit-empty]');
  if (empty) empty.hidden = toolkit.items.length > 0;
}

function apply(next: Toolkit): void {
  toolkit = next;
  syncButtons();
  renderPage();
}

function commit(next: Toolkit): boolean {
  apply(next);

  const saved = writeToolkit(next);
  if (!saved) {
    showStatus(t(lang, 'toolkit.storageUnavailable'), true);
    return false;
  }

  clearStatus();
  window.dispatchEvent(new CustomEvent(TOOLKIT_EVENT, { detail: next }));
  return true;
}

function refresh(): void {
  apply(readToolkit());
}

function exportToolkit(): void {
  const blob = new Blob([`${JSON.stringify(toolkit, null, 2)}\n`], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'yoto-toolkit.json';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  showStatus(t(lang, 'toolkit.exported'));
}

async function importToolkit(file: File): Promise<void> {
  try {
    const imported = parseToolkitImport(await file.text());
    if (!imported) {
      showStatus(t(lang, 'toolkit.importError'), true);
      return;
    }

    const merged = mergeToolkits(toolkit, imported);
    if (commit(merged)) showStatus(t(lang, 'toolkit.imported'));
  } catch {
    showStatus(t(lang, 'toolkit.importError'), true);
  }
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const toggle = target.closest<HTMLButtonElement>('[data-toolkit-toggle]');
  if (toggle) {
    const type = toggle.dataset.toolkitType;
    const id = toggle.dataset.toolkitId;
    if (!isType(type) || !id) return;

    commit(
      toggleItem(toolkit, {
        type,
        id,
        title: toggle.dataset.toolkitTitle || id,
        addedAt: today(),
      }),
    );
    return;
  }

  const remove = target.closest<HTMLButtonElement>('[data-toolkit-remove]');
  if (remove) {
    const type = remove.dataset.toolkitType;
    const id = remove.dataset.toolkitId;
    if (!isType(type) || !id) return;
    commit(removeItem(toolkit, type, id));
    return;
  }

  if (target.closest('[data-toolkit-export]')) {
    exportToolkit();
    return;
  }

  if (target.closest('[data-toolkit-print]')) {
    window.print();
  }
});

const importInput = page?.querySelector<HTMLInputElement>('[data-toolkit-import]');
importInput?.addEventListener('change', () => {
  const file = importInput.files?.[0];
  importInput.value = '';
  if (file) void importToolkit(file);
});

window.addEventListener('storage', (event) => {
  if (
    event.key === TOOLKIT_KEY ||
    (event.key !== null && LEGACY_TOOLKIT_KEYS.some((legacy) => legacy.key === event.key))
  ) {
    refresh();
  }
});

window.addEventListener(TOOLKIT_EVENT, refresh);

if (page && !safeStorage()) {
  showStatus(t(lang, 'toolkit.storageUnavailable'), true);
}

refresh();
