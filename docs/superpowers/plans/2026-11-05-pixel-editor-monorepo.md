# Extraction de l’éditeur d’icônes — Plan d’implémentation monorepo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraire l’éditeur d’icônes 16×16 existant de `icons-catalogue` dans deux packages réutilisables (`pixel-editor-core` et `pixel-editor-react`) au sein d’un monorepo pnpm unifié, puis utiliser le cœur dans le générateur de labels d’Awesome Yoto, avec l’éditeur React chargé à la demande.

**Architecture:** `icons-catalogue` devient un workspace pnpm avec `site/` et `packages/*`. `pixel-editor-core` est du TypeScript pur (grille, reducer, PNG, réduction d’image, stockage, clavier). `pixel-editor-react` encapsule l’UI React existante. Le portail consomme le package core pour l’upload, la réduction, le PNG et l’impression, et charge `pixel-editor-react` uniquement quand l’utilisateur clique sur « Modifier l’icône ».

**Tech Stack:** Node 22, pnpm 12.4.2 pour le monorepo `icons-catalogue`, TypeScript 5, React 19, Vite 8, Vitest 5, Astro 7, Changesets, GitHub Actions.

**Spec :** Les décisions de conception sont dans la section « Décisions de conception » ci-dessous. Il n’y a pas de fichier de spec séparé.

---

## Contraintes globales

- Licence MIT, copyright `2026 Sylvain (yoto-community)` conservé.
- `pixel-editor-core` n’a **aucune dépendance runtime** et n’importe ni React ni le DOM, sauf l’export `./browser`.
- `pixel-editor-react` déclare `react` et `react-dom` en `peerDependencies` (React 19).
- Aucune duplication : après migration, les fichiers déplacés sont supprimés de `site/`.
- Le comportement de `/editor` dans `icons-catalogue` ne doit pas changer pendant les phases 1 et 2.
- Le portail ne doit pas charger React au chargement initial de `/myo/labels/`.
- Le label generator et le catalogue n’utilisent pas la même clé `localStorage`.
- Les packages sont ESM uniquement.
- Chaque tâche se termine par des tests, une vérification et un commit.
- Les versions des packages commencent à `0.1.0` après la première publication.
- Le monorepo `icons-catalogue` garde `site/` à la racine ; on ne le déplace pas dans `apps/site`.

---

## 1. État actuel

### 1.1 L’éditeur existant

L’éditeur est déjà bien isolé dans `icons-catalogue/site/src` :

| Couche               | Fichiers                                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cœur pur             | `constants/editor.ts`, `utils/pixelEditor.ts`, `utils/imageImport.ts`, `utils/pngExport.ts`, `utils/editorStorage.ts`, `utils/editorKeyboard.ts`                           |
| Frontière navigateur | `utils/imageDecode.ts`                                                                                                                                                     |
| UI React             | `components/editor/*.tsx`                                                                                                                                                  |
| Hooks                | `hooks/usePixelEditor.ts`, `hooks/useEditorDraft.ts`, `hooks/useImageImport.ts`                                                                                            |
| CSS                  | ~470 lignes `.pixel-editor`, `.editor-*`, `.pixel-grid*` dans `site/src/styles.css`                                                                                        |
| i18n                 | section `editor` de `site/src/i18n/locales/{en,fr}.json`                                                                                                                   |
| Tests                | `pixelEditor.test.ts`, `imageImport.test.ts`, `pngExport.test.ts`, `editorStorage.test.ts`, `editorKeyboard.test.ts`, `imageDecode.test.ts`, tests des composants et hooks |

L’éditeur est accessible (`role="grid"`, navigation clavier), testé, et sous licence MIT. C’est un bon candidat à l’extraction.

### 1.2 Pourquoi un monorepo dans `icons-catalogue`

`icons-catalogue` n’est pas encore un monorepo : la racine (scrapers, `scripts/`, `data/`) et `site/` ont deux `pnpm-lock.yaml` et deux installations. Le passage en monorepo est un prérequis pour que `site/` et les packages partagent une seule installation et un seul lockfile.

### 1.3 Contraintes du portail

- Astro 7, pas de React aujourd’hui.
- Budget JS actuel : 4,4 Ko gzip, plafond 30 Ko.
- Le label generator doit rester léger au chargement initial.
- L’éditeur React complet sera chargé uniquement à la demande.

---

## 2. Décisions de conception

1. **Un seul dépôt** : `yoto-community/icons-catalogue`, transformé en monorepo pnpm.
2. **Deux packages** :
   - `@yoto-community/pixel-editor-core` ;
   - `@yoto-community/pixel-editor-react`.
3. **`site/` reste à la racine** pour limiter le churn et préserver le déploiement Pages.
4. **Le cœur est la source de vérité** : grille RGBA, reducer, PNG, réduction d’image, stockage, clavier.
5. **L’UI React est réutilisée**, pas réécrite : on conserve l’accessibilité et les tests existants.
6. **i18n injectée** : plus de dépendance au contexte i18n du catalogue.
7. **CSS thémable** : variables `--pe-*` avec valeurs par défaut, thème par application.
8. **Stockage paramétrable** : `storageKey` pour éviter les collisions.
9. **Mode compact** : masquer les actions non pertinentes dans le label generator.
10. **Portail** :
    - le parcours initial (upload, réduction, aperçu, impression) utilise `core` sans React ;
    - le bouton « Modifier l’icône » charge dynamiquement `pixel-editor-react` ;
    - le chunk éditeur est exclu du budget JS principal, avec un budget séparé.
11. **Publication** : npm public recommandé. Si le scope `@yoto-community` n’est pas disponible, utiliser des tarballs GitHub Releases (Tâche 7B).
12. **Versionnement** : Changesets, packages publiés indépendamment du site.

### Décisions encore ouvertes

- **Canal de distribution** : npm public ou tarballs GitHub Releases. Cette décision est requise avant la Tâche 7.
- **Intégration portail** : le plan suppose l’éditeur React en lazy load. Si le budget React est refusé, remplacer la Tâche 10 par un mini-éditeur vanilla basé sur `core`.
- **Version de pnpm** : le monorepo utilise `pnpm@12.4.2` (déjà dans `package.json`). Le portail reste sur `pnpm@10.11.0` ; les packages publiés sont indépendants.

---

## 3. Structure cible

```text
icons-catalogue/
  pnpm-workspace.yaml
  package.json                     # racine privée + scripts data/scraping
  site/                            # app React/Vite existante
  packages/
    pixel-editor-core/
      package.json
      tsconfig.json
      src/
        index.ts
        constants.ts
        pixel-editor.ts
        image-import.ts
        png.ts
        crc32.ts
        storage.ts
        keyboard.ts
        browser/
          index.ts
          image-decode.ts
      tests/
        pixel-editor.test.ts
        image-import.test.ts
        png.test.ts
        storage.test.ts
        keyboard.test.ts
        image-decode.test.ts
    pixel-editor-react/
      package.json
      tsconfig.json
      scripts/
        copy-css.mjs
      src/
        index.ts
        PixelEditor.tsx
        PixelGridEditor.tsx
        EditorToolbar.tsx
        EditorHistoryBar.tsx
        EditorPalette.tsx
        EditorColorCurrent.tsx
        EditorPreview.tsx
        EditorStatus.tsx
        EditorImportPanel.tsx
        messages.ts
        theme.css
        styles.css
      tests/
        PixelEditor.test.tsx
        PixelGridEditor.test.tsx
        EditorToolbar.test.tsx
        EditorHistoryBar.test.tsx
        EditorPalette.test.tsx
        EditorColorCurrent.test.tsx
        EditorPreview.test.tsx
        EditorStatus.test.tsx
        EditorImportPanel.test.tsx
```

Fichiers portail concernés :

```text
yoto-community.github.io/
  site/src/lib/label-sheet.ts
  site/src/lib/label-sheet.test.ts
  site/src/lib/label-icon.ts
  site/src/scripts/label-generator.ts
  site/src/views/LabelGeneratorView.astro
  site/src/pages/myo/labels/index.astro
  site/src/pages/fr/myo/labels/index.astro
  site/src/styles/label.css
  site/src/styles/editor-theme.css
  site/src/i18n/en.ts
  site/src/i18n/fr.ts
  site/package.json
  site/astro.config.mjs
  scripts/check-budget.ts
  scripts/check-search.ts
  site/e2e/labels.spec.ts
```

---

## 4. Tâches

### Tâche 1 : Unifier le workspace `icons-catalogue`

**Files:**

- Create: `../icons-catalogue/pnpm-workspace.yaml`
- Modify: `../icons-catalogue/package.json`
- Delete: `../icons-catalogue/site/pnpm-lock.yaml`, `../icons-catalogue/site/pnpm-workspace.yaml`
- Modify: `../icons-catalogue/.github/workflows/ci.yml`, `deploy-pages.yml`, `update-icons.yml`
- Modify: `../icons-catalogue/README.md`

**Interfaces:**

- Produces: un seul lockfile racine, un workspace `site` + `packages/*`.
- Consumes: rien.

- [ ] **Step 1: Créer le workspace racine**

```yaml
# icons-catalogue/pnpm-workspace.yaml
packages:
  - site
  - packages/*

allowBuilds:
  esbuild: false
```

- [ ] **Step 2: Rendre la racine privée et ajouter les scripts de workspace**

Dans `icons-catalogue/package.json` :

```json
{
  "private": true,
  "scripts": {
    "dev:site": "pnpm --filter site dev",
    "build:site": "pnpm --filter site build",
    "test:site": "pnpm --filter site test",
    "verify:site": "pnpm --filter site verify"
  }
}
```

Conserver les scripts existants `scrape:*`, `build:api`, `update:all`, `update:readme`, `check:readme`, `test`.

- [ ] **Step 3: Supprimer les lockfiles/workspaces du site**

```bash
cd ../icons-catalogue
rm site/pnpm-lock.yaml site/pnpm-workspace.yaml
pnpm install
```

- [ ] **Step 4: Adapter la CI**

Dans `icons-catalogue/.github/workflows/ci.yml` :

- supprimer `defaults.run.working-directory: site` ;
- installer depuis la racine :

```yaml
- name: Install dependencies
  run: pnpm install --frozen-lockfile
```

- exécuter les commandes du site avec `--filter` :

```yaml
- run: pnpm --filter site run lint
- run: pnpm --filter site run format:check
- run: pnpm --filter site run check
- run: pnpm --filter site run check:i18n
- run: pnpm --filter site run test:coverage
```

- conserver les étapes racine existantes : `pnpm run build:api`, `node scripts/check-summary-sync.js`, `node scripts/check-readme-data.js`, `pnpm run check:bundle`, `pnpm run check:spa`, `pnpm run check:precache`, `pnpm run check:seo` ;
- retirer l’étape redondante « Install root dependencies » (une seule installation racine suffit) ;
- dans le job `e2e`, supprimer `defaults.run.working-directory: site`, remplacer `cache-dependency-path: site/pnpm-lock.yaml` par `pnpm-lock.yaml`, installer à la racine et lancer `pnpm --filter site run test:e2e`.

Dans `deploy-pages.yml` :

- une seule installation racine ;
- `pnpm --filter site run build` ;
- conserver `path: site/dist`.

Dans `update-icons.yml`, l’installation racine suffit ; vérifier que `cache-dependency-path` pointe sur `pnpm-lock.yaml`.

- [ ] **Step 5: Mettre à jour le README**

Remplacer les instructions `cd site && pnpm install` par :

```bash
pnpm install
pnpm --filter site run dev
```

- [ ] **Step 6: Vérifier**

```bash
cd ../icons-catalogue
pnpm install --frozen-lockfile
pnpm run build:api
pnpm --filter site run check
pnpm --filter site run test
pnpm --filter site run build
```

Expected: toutes les commandes passent ; il ne reste qu’un `pnpm-lock.yaml` à la racine.

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml package.json site/package.json pnpm-lock.yaml README.md .github/workflows
git commit -m "chore: convert icons-catalogue to a pnpm monorepo"
```

---

### Tâche 2 : Créer `pixel-editor-core` et y déplacer le cœur pur

**Files:**

- Create: `../icons-catalogue/packages/pixel-editor-core/package.json`
- Create: `../icons-catalogue/packages/pixel-editor-core/tsconfig.json`
- Create: `../icons-catalogue/packages/pixel-editor-core/src/index.ts`
- Create: `../icons-catalogue/packages/pixel-editor-core/src/browser/index.ts`
- Move: `site/src/constants/editor.ts` → `packages/pixel-editor-core/src/constants.ts`
- Move: `site/src/utils/pixelEditor.ts` → `packages/pixel-editor-core/src/pixel-editor.ts`
- Move: `site/src/utils/imageImport.ts` → `packages/pixel-editor-core/src/image-import.ts`
- Move: `site/src/utils/pngExport.ts` → `packages/pixel-editor-core/src/png.ts`
- Move: `site/src/utils/editorStorage.ts` → `packages/pixel-editor-core/src/storage.ts`
- Move: `site/src/utils/editorKeyboard.ts` → `packages/pixel-editor-core/src/keyboard.ts`
- Move: `site/src/utils/imageDecode.ts` → `packages/pixel-editor-core/src/browser/image-decode.ts`
- Create: `packages/pixel-editor-core/src/crc32.ts` (copie de `crc32` depuis `site/src/utils/zip.ts`)
- Move tests correspondants dans `packages/pixel-editor-core/tests/`

**Interfaces:**

- Produces:
  - `PixelGrid`, `Rgba`, `EditorTool`, `EditorState`, `EditorAction`
  - `createGrid`, `cloneGrid`, `getPixel`, `setPixel`, `floodFill`, `isEmpty`, `countColors`, `hasPureBlack`
  - `hexToRgba`, `rgbaToHex`, `encodeGrid`, `decodeGrid`
  - `createEditorState`, `editorReducer`
  - `encodePng`, `createPngBlob`, `encodePngDataUrl`
  - `fitAnalysisSize`, `alphaBoxDownscale`, `imageDataToGrid`
  - `saveDraft`, `loadDraft`, `clearDraft`, `isDraftStorageAvailable`
  - `moveFocus`, `isActivationKey`, `paletteIndexForShortcut`, `toolForShortcut`
  - `decodeImageBlob` (export `./browser`)
- Consumes: rien.

- [ ] **Step 1: Créer le package**

```json
{
  "name": "@yoto-community/pixel-editor-core",
  "version": "0.0.0",
  "type": "module",
  "license": "MIT",
  "sideEffects": false,
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./browser": {
      "types": "./dist/browser/index.d.ts",
      "import": "./dist/browser/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "check": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vitest": "^5.1.0"
  }
}
```

`tsconfig.json` :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Déplacer les fichiers**

```bash
cd ../icons-catalogue
mkdir -p packages/pixel-editor-core/src/browser packages/pixel-editor-core/tests
git mv site/src/constants/editor.ts packages/pixel-editor-core/src/constants.ts
git mv site/src/utils/pixelEditor.ts packages/pixel-editor-core/src/pixel-editor.ts
git mv site/src/utils/imageImport.ts packages/pixel-editor-core/src/image-import.ts
git mv site/src/utils/pngExport.ts packages/pixel-editor-core/src/png.ts
git mv site/src/utils/editorStorage.ts packages/pixel-editor-core/src/storage.ts
git mv site/src/utils/editorKeyboard.ts packages/pixel-editor-core/src/keyboard.ts
git mv site/src/utils/imageDecode.ts packages/pixel-editor-core/src/browser/image-decode.ts
git mv site/src/utils/pixelEditor.test.ts packages/pixel-editor-core/tests/pixel-editor.test.ts
git mv site/src/utils/imageImport.test.ts packages/pixel-editor-core/tests/image-import.test.ts
git mv site/src/utils/pngExport.test.ts packages/pixel-editor-core/tests/png.test.ts
git mv site/src/utils/editorStorage.test.ts packages/pixel-editor-core/tests/storage.test.ts
git mv site/src/utils/editorKeyboard.test.ts packages/pixel-editor-core/tests/keyboard.test.ts
git mv site/src/utils/imageDecode.test.ts packages/pixel-editor-core/tests/image-decode.test.ts
```

- [ ] **Step 3: Isoler `crc32`**

Créer `packages/pixel-editor-core/src/crc32.ts` avec la même implémentation que `site/src/utils/zip.ts`, puis dans `png.ts` :

```ts
import { crc32 } from './crc32';
```

Laisser `site/src/utils/zip.ts` inchangé pour éviter une dépendance inverse du catalogue vers l’éditeur.

- [ ] **Step 4: Écrire les exports publics**

`src/index.ts` :

```ts
export * from './constants';
export * from './pixel-editor';
export * from './image-import';
export * from './png';
export * from './storage';
export * from './keyboard';
```

`src/browser/index.ts` :

```ts
export * from './image-decode';
```

- [ ] **Step 5: Corriger les imports internes**

Les fichiers déplacés importent encore les modules voisins (`../constants/editor`, `./pixelEditor`, `./imageImport`, `./pngExport`, `./editorStorage`, `./editorKeyboard`, `./imageDecode`). Les remplacer par les chemins locaux du package :

```ts
// avant
import { GRID_SIZE } from '../constants/editor';
// après
import { GRID_SIZE } from './constants';
```

Même travail dans les tests.

- [ ] **Step 6: Tester le package seul**

```bash
cd ../icons-catalogue
pnpm --filter @yoto-community/pixel-editor-core test
pnpm --filter @yoto-community/pixel-editor-core build
```

Expected: tous les tests passent, `dist/index.js`, `dist/index.d.ts` et `dist/browser/*` sont générés.

- [ ] **Step 7: Commit**

```bash
git add packages/pixel-editor-core
git commit -m "feat(pixel-editor-core): extract the pure 16x16 editor core"
```

---

### Tâche 3 : Faire consommer le core par `site/`

**Files:**

- Modify: `../icons-catalogue/site/package.json`
- Modify: `../icons-catalogue/site/src/components/editor/*.tsx`
- Modify: `../icons-catalogue/site/src/hooks/usePixelEditor.ts`, `useEditorDraft.ts`, `useImageImport.ts`
- Delete: les anciens fichiers cœur déjà déplacés (déjà fait par `git mv`)
- Modify: `../icons-catalogue/site/src/utils/zip.ts` si un import de `crc32` est nécessaire (normalement non)

**Interfaces:**

- Consumes: `@yoto-community/pixel-editor-core`.
- Produces: `site` compile et fonctionne sans copie locale du cœur.

- [ ] **Step 1: Ajouter la dépendance workspace**

Dans `site/package.json` :

```json
{
  "dependencies": {
    "@yoto-community/pixel-editor-core": "workspace:*"
  }
}
```

- [ ] **Step 2: Remplacer les imports**

Exemple :

```ts
// avant
import { getPixel, type PixelGrid } from '../../utils/pixelEditor';
// après
import { getPixel, type PixelGrid } from '@yoto-community/pixel-editor-core';
```

Faire la même chose dans tous les composants de `components/editor` et les hooks.

- [ ] **Step 3: Remplacer l’import de l’imageDecode**

```ts
// avant
import { decodeImageBlob } from '../utils/imageDecode';
// après
import { decodeImageBlob } from '@yoto-community/pixel-editor-core/browser';
```

- [ ] **Step 4: Vérifier**

```bash
cd ../icons-catalogue
pnpm install
pnpm --filter site run check
pnpm --filter site run test
pnpm --filter site run build
```

Expected: aucune référence restante à `utils/pixelEditor`, `utils/imageImport`, `utils/pngExport`, `utils/editorStorage`, `utils/editorKeyboard`, `utils/imageDecode` :

```bash
grep -R "utils/pixelEditor\|utils/imageImport\|utils/pngExport\|utils/editorStorage\|utils/editorKeyboard\|utils/imageDecode" site/src
```

Expected: aucune sortie.

- [ ] **Step 5: Commit**

```bash
git add site/package.json site/src
git commit -m "refactor(site): consume the extracted pixel editor core"
```

---

### Tâche 4 : Ajouter Changesets et préparer la publication du core

**Files:**

- Create: `../icons-catalogue/.changeset/config.json`
- Create: `../icons-catalogue/.changeset/*.md` (changeset initial)
- Modify: `../icons-catalogue/package.json`
- Create: `../icons-catalogue/packages/pixel-editor-core/README.md`

**Interfaces:**
-Produces: versionnement et publication des packages.

- [ ] **Step 1: Installer Changesets**

```bash
cd ../icons-catalogue
pnpm add -Dw @changesets/cli
pnpm changeset init
```

- [ ] **Step 2: Configurer Changesets**

`.changeset/config.json` :

```json
{
  "$schema": "https://unpkg.com/@changesets/config@4.0.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["site"]
}
```

- [ ] **Step 3: Ajouter les scripts racine**

```json
{
  "scripts": {
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "pnpm --filter './packages/*' build && changeset publish"
  }
}
```

- [ ] **Step 4: Ajouter le README du core**

Documenter l’API publique, les exports `./browser`, la licence MIT et un exemple minimal :

```ts
import { createGrid, setPixel, encodePngDataUrl } from '@yoto-community/pixel-editor-core';
```

- [ ] **Step 5: Créer le changeset initial**

```bash
pnpm changeset
# sélectionner @yoto-community/pixel-editor-core
# type: minor
# résumé: "Extract the pure 16x16 pixel editor core"
```

- [ ] **Step 6: Vérifier le build et le packaging**

```bash
pnpm --filter @yoto-community/pixel-editor-core build
pnpm --filter @yoto-community/pixel-editor-core exec publint
```

Ajouter `publint` en devDependency si nécessaire.

- [ ] **Step 7: Commit**

```bash
git add .changeset package.json packages/pixel-editor-core/README.md pnpm-lock.yaml
git commit -m "chore: add Changesets for the pixel editor packages"
```

---

### Tâche 5 : Créer `pixel-editor-react` et déplacer l’UI

**Files:**

- Create: `../icons-catalogue/packages/pixel-editor-react/package.json`
- Create: `../icons-catalogue/packages/pixel-editor-react/tsconfig.json`
- Create: `../icons-catalogue/packages/pixel-editor-react/scripts/copy-css.mjs`
- Create: `../icons-catalogue/packages/pixel-editor-react/vitest.config.ts`
- Create: `../icons-catalogue/packages/pixel-editor-react/tests/setup.ts`
- Create: `../icons-catalogue/packages/pixel-editor-react/src/index.ts`
- Move: `site/src/components/editor/*.tsx` → `packages/pixel-editor-react/src/`
- Move: `site/src/hooks/usePixelEditor.ts`, `useEditorDraft.ts`, `useImageImport.ts`
- Create: `packages/pixel-editor-react/src/messages.ts`
- Create: `packages/pixel-editor-react/src/styles.css`
- Move tests correspondants.

**Interfaces:**

- Produces:
  - `PixelEditor`
  - `mountPixelEditor(element, props): () => void`
  - `EditorMessages`, `en`, `fr`, `createTranslator`
  - `pixel-editor-react/styles.css`
- Consumes: `@yoto-community/pixel-editor-core`, React 19.

- [ ] **Step 1: Créer le package**

```json
{
  "name": "@yoto-community/pixel-editor-react",
  "version": "0.0.0",
  "type": "module",
  "license": "MIT",
  "sideEffects": ["*.css"],
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./styles.css": "./dist/styles.css"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "dependencies": {
    "@yoto-community/pixel-editor-core": "workspace:*"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json && node scripts/copy-css.mjs",
    "check": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^7.0.1",
    "@testing-library/react": "^16.3.3",
    "@testing-library/user-event": "^14.6.8",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.2",
    "jsdom": "^30.1.3",
    "react": "^19.3.1",
    "react-dom": "^19.3.1",
    "typescript": "^5.6.3",
    "vitest": "^5.1.0"
  }
}
```

`vitest.config.ts` :

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.tsx'],
  },
});
```

`tests/setup.ts` :

```ts
import '@testing-library/jest-dom/vitest';
```

`tsconfig.json` : `jsx: "react-jsx"`, `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `declaration: true`, `outDir: "dist"`.

- [ ] **Step 2: Déplacer l’UI et les hooks**

```bash
cd ../icons-catalogue
mkdir -p packages/pixel-editor-react/src packages/pixel-editor-react/tests
git mv site/src/components/editor/PixelEditor.tsx packages/pixel-editor-react/src/PixelEditor.tsx
git mv site/src/components/editor/PixelGridEditor.tsx packages/pixel-editor-react/src/PixelGridEditor.tsx
git mv site/src/components/editor/EditorToolbar.tsx packages/pixel-editor-react/src/EditorToolbar.tsx
git mv site/src/components/editor/EditorHistoryBar.tsx packages/pixel-editor-react/src/EditorHistoryBar.tsx
git mv site/src/components/editor/EditorPalette.tsx packages/pixel-editor-react/src/EditorPalette.tsx
git mv site/src/components/editor/EditorColorCurrent.tsx packages/pixel-editor-react/src/EditorColorCurrent.tsx
git mv site/src/components/editor/EditorPreview.tsx packages/pixel-editor-react/src/EditorPreview.tsx
git mv site/src/components/editor/EditorStatus.tsx packages/pixel-editor-react/src/EditorStatus.tsx
git mv site/src/components/editor/EditorImportPanel.tsx packages/pixel-editor-react/src/EditorImportPanel.tsx
git mv site/src/hooks/usePixelEditor.ts packages/pixel-editor-react/src/usePixelEditor.ts
git mv site/src/hooks/useEditorDraft.ts packages/pixel-editor-react/src/useEditorDraft.ts
git mv site/src/hooks/useImageImport.ts packages/pixel-editor-react/src/useImageImport.ts
```

Déplacer les tests de composants/hooks vers `packages/pixel-editor-react/tests/`, puis mettre à jour leurs imports vers les chemins locaux du package (`../src/PixelEditor`, `./setup`, etc.).

- [ ] **Step 3: Injecter l’i18n**

Créer `src/messages.ts` :

```ts
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function createTranslator(messages: Record<string, string>): Translate {
  return (key, vars = {}) => {
    const template = messages[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
  };
}
```

Copier la section `editor` de `site/src/i18n/locales/en.json` et `fr.json` dans deux dictionnaires plats `en` et `fr`. Conserver toutes les clés présentes dans ces sections (`editor.title`, `editor.subtitle`, `editor.grid.cellAria`, etc.).

`PixelEditor` accepte :

```ts
export interface PixelEditorProps {
  initialGrid?: PixelGrid;
  initialImageUrl?: string;
  messages?: Record<string, string>;
  t?: Translate;
  storageKey?: string;
  compact?: boolean;
  showActions?: boolean;
  onChange?: (grid: PixelGrid) => void;
  onExport?: (dataUrl: string) => void;
}
```

Créer un contexte interne `EditorTContext` et remplacer `useI18n()` par `useEditorT()`.

- [ ] **Step 4: Découpler le stockage**

Modifier `storage.ts` du core pour accepter une clé :

```ts
export function saveDraft(grid: PixelGrid, key: string, updatedAt = Date.now()): boolean;
export function loadDraft(key: string): PixelGrid | null;
export function clearDraft(key: string): void;
```

`useEditorDraft(grid, delayMs, storageKey)` transmet la clé. `PixelEditor` utilise `storageKey = 'yoto-icons-editor-draft'` par défaut. Mettre à jour `packages/pixel-editor-core/tests/storage.test.ts` pour passer explicitement une clé de test.

- [ ] **Step 5: Découpler le CSS**

Déplacer les règles `.pixel-editor`, `.editor-*`, `.pixel-grid*` de `site/src/styles.css` vers `packages/pixel-editor-react/src/styles.css`.

Remplacer les variables :

| Catalogue                | Package                     |
| ------------------------ | --------------------------- |
| `--color-text`           | `--pe-color-text`           |
| `--color-text-muted`     | `--pe-color-text-muted`     |
| `--color-text-secondary` | `--pe-color-text-secondary` |
| `--color-border`         | `--pe-color-border`         |
| `--color-surface`        | `--pe-color-surface`        |
| `--color-surface-muted`  | `--pe-color-surface-muted`  |
| `--color-primary`        | `--pe-color-primary`        |
| `--color-primary-dark`   | `--pe-color-primary-dark`   |
| `--color-primary-light`  | `--pe-color-primary-light`  |
| `--color-text-inverse`   | `--pe-color-text-inverse`   |
| `--space-1..6`           | `--pe-space-1..6`           |
| `--radius`               | `--pe-radius`               |
| `--text-*`               | `--pe-text-*`               |

Ajouter un bloc de valeurs par défaut dans `.pixel-editor` pour que le package soit utilisable sans thème.

- [ ] **Step 6: Ajouter le montage impératif**

`src/index.ts` :

```ts
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { PixelEditor, type PixelEditorProps } from './PixelEditor';

export * from './PixelEditor';
export * from './messages';

export function mountPixelEditor(element: HTMLElement, props: PixelEditorProps): () => void {
  const root = createRoot(element);
  root.render(createElement(PixelEditor, props));
  return () => root.unmount();
}
```

- [ ] **Step 7: Ajouter le mode compact**

Dans `PixelEditor`, masquer les actions « Télécharger le PNG » et « Nouvelle icône » si `compact` ou `showActions === false`. Ajouter un test :

```tsx
it('hides the download action in compact mode', () => {
  render(<PixelEditor compact />);
  expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 8: Tester et builder**

```bash
pnpm --filter @yoto-community/pixel-editor-react test
pnpm --filter @yoto-community/pixel-editor-react build
```

Expected: tests passent, `dist/index.js`, `dist/index.d.ts`, `dist/styles.css` générés.

- [ ] **Step 9: Commit**

```bash
git add packages/pixel-editor-react
git commit -m "feat(pixel-editor-react): extract the accessible editor UI"
```

---

### Tâche 6 : Faire consommer le package React par `site/`

**Files:**

- Modify: `../icons-catalogue/site/package.json`
- Modify: `../icons-catalogue/site/src/App.tsx`
- Modify: tous les fichiers qui importent `components/editor`, `hooks/usePixelEditor`, `hooks/useEditorDraft` ou `hooks/useImageImport` (les trouver avec `grep -R`).
- Create: `../icons-catalogue/site/src/styles/editor-theme.css`
- Modify: `../icons-catalogue/site/src/styles.css` (supprimer les règles déplacées)
- Modify: `../icons-catalogue/site/src/i18n/locales/{en,fr}.json` (retirer les clés editor inutilisées)

**Interfaces:**

- Consumes: `@yoto-community/pixel-editor-react`.
- Produces: `/editor` fonctionne via le package.

- [ ] **Step 1: Ajouter la dépendance**

```json
{
  "dependencies": {
    "@yoto-community/pixel-editor-core": "workspace:*",
    "@yoto-community/pixel-editor-react": "workspace:*"
  }
}
```

- [ ] **Step 2: Remplacer les imports**

Dans `App.tsx` :

```ts
const EditorPage = lazy(() =>
  import('@yoto-community/pixel-editor-react').then((module) => ({
    default: module.PixelEditor,
  })),
);
```

Passer les messages du catalogue :

```tsx
<PixelEditor messages={editorMessages} storageKey="yoto-icons-editor-draft" />
```

- [ ] **Step 3: Ajouter le thème**

`site/src/styles/editor-theme.css` :

```css
.pe-theme-yoto {
  --pe-color-text: var(--color-text);
  --pe-color-text-muted: var(--color-text-muted);
  --pe-color-text-secondary: var(--color-text-secondary);
  --pe-color-border: var(--color-border);
  --pe-color-surface: var(--color-surface);
  --pe-color-surface-muted: var(--color-surface-muted);
  --pe-color-primary: var(--color-primary);
  --pe-color-primary-dark: var(--color-primary-dark);
  --pe-color-primary-light: var(--color-primary-light);
  --pe-color-text-inverse: var(--color-text-inverse);
  --pe-space-1: var(--space-1);
  --pe-space-2: var(--space-2);
  --pe-space-3: var(--space-3);
  --pe-space-4: var(--space-4);
  --pe-space-5: var(--space-5);
  --pe-space-6: var(--space-6);
  --pe-radius: var(--radius);
  --pe-text-xs: var(--text-xs);
  --pe-text-sm: var(--text-sm);
  --pe-text-2xl: var(--text-2xl);
}
```

Ajouter `pe-theme-yoto` au conteneur de l’éditeur et importer `@yoto-community/pixel-editor-react/styles.css`.

- [ ] **Step 4: Nettoyer**

Supprimer les anciens fichiers locaux et les règles CSS déplacées. Vérifier :

```bash
grep -R "components/editor\|hooks/usePixelEditor\|hooks/useEditorDraft\|hooks/useImageImport" site/src
```

Expected: aucune sortie.

- [ ] **Step 5: Vérifier**

```bash
pnpm --filter site run check
pnpm --filter site run test
pnpm --filter site run build
pnpm --filter site run test:e2e
```

- [ ] **Step 6: Commit**

```bash
git add site
git commit -m "refactor(site): consume the extracted pixel editor React package"
```

---

### Tâche 7 : Publier `0.1.0`

> **Decision gate:** choisir 7A (npm public) ou 7B (tarballs GitHub Releases) avant de commencer.

#### 7A — npm public

**Files:**

- Create: `../icons-catalogue/.github/workflows/publish-packages.yml`
- Modify: `.changeset/config.json`
- Create: changeset de version

- [ ] **Step 1: Vérifier le scope npm**

```bash
npm whoami
npm view @yoto-community/pixel-editor-core version
```

Expected: le compte a accès au scope `@yoto-community` (ou le scope est créé).

- [ ] **Step 2: Versionner**

```bash
pnpm changeset
# sélectionner les deux packages, type minor
pnpm version-packages
```

Expected: versions `0.1.0` dans les deux `package.json`.

- [ ] **Step 3: Ajouter le workflow de publication**

```yaml
name: Publish pixel editor packages

on:
  push:
    tags:
      - 'pixel-editor-v*'

permissions:
  contents: read
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm
          registry-url: https://registry.npmjs.org
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter './packages/*' build
      - run: pnpm changeset publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 4: Publier**

```bash
git add .changeset packages/*/package.json packages/*/CHANGELOG.md
git commit -m "chore: release pixel editor packages 0.1.0"
git tag pixel-editor-v0.1.0
git push origin main --tags
```

Expected: workflow vert, `npm view @yoto-community/pixel-editor-core version` renvoie `0.1.0`.

#### 7B — Tarballs GitHub Releases

- [ ] **Step 1: Construire et packager**

```bash
pnpm --filter './packages/*' build
pnpm --filter @yoto-community/pixel-editor-core pack
pnpm --filter @yoto-community/pixel-editor-react pack
```

- [ ] **Step 2: Publier une release**

Créer une release GitHub `pixel-editor-v0.1.0` avec les deux `.tgz`.

- [ ] **Step 3: Documenter les URLs**

Dans le README du portail et dans ce plan, noter :

```text
https://github.com/yoto-community/icons-catalogue/releases/download/pixel-editor-v0.1.0/yoto-community-pixel-editor-core-0.1.0.tgz
https://github.com/yoto-community/icons-catalogue/releases/download/pixel-editor-v0.1.0/yoto-community-pixel-editor-react-0.1.0.tgz
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document pixel editor release tarballs"
```

---

### Tâche 8 : Portail — géométrie de la planche et utilitaires core

**Files:**

- Modify: `site/package.json`
- Create: `site/src/lib/label-sheet.ts`
- Create: `site/src/lib/label-sheet.test.ts`
- Create: `site/src/lib/label-icon.ts`

**Interfaces:**

- Consumes: `@yoto-community/pixel-editor-core` (ou URLs de tarball si 7B).
- Produces:
  - `Paper`, `LabelSheetConfig`, `LabelPosition`, `labelPositions`, `paperSizeMm`
  - `iconFromFile(file: File): Promise<{ grid: PixelGrid; dataUrl: string }>`

- [ ] **Step 1: Ajouter la dépendance**

Dans `site/package.json` :

```json
{
  "dependencies": {
    "@yoto-community/pixel-editor-core": "^0.1.0"
  }
}
```

Si 7B :

```json
"@yoto-community/pixel-editor-core": "https://github.com/yoto-community/icons-catalogue/releases/download/pixel-editor-v0.1.0/yoto-community-pixel-editor-core-0.1.0.tgz"
```

- [ ] **Step 2: Écrire le test de géométrie**

`site/src/lib/label-sheet.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { labelPositions, paperSizeMm, type LabelSheetConfig } from './label-sheet';

const config: LabelSheetConfig = {
  paper: 'a4',
  columns: 2,
  rows: 5,
  labelWidthMm: 90,
  labelHeightMm: 48,
  marginXMm: 10,
  marginYMm: 10,
  gapXMm: 4,
  gapYMm: 4,
};

describe('labelPositions', () => {
  it('returns ten positions for a 2x5 sheet', () => {
    expect(labelPositions(config)).toHaveLength(10);
  });

  it('places the first label inside the margins', () => {
    expect(labelPositions(config)[0]).toEqual({
      xMm: 10,
      yMm: 10,
      widthMm: 90,
      heightMm: 48,
    });
  });

  it('keeps every label inside the paper', () => {
    const paper = paperSizeMm('a4');
    for (const label of labelPositions(config)) {
      expect(label.xMm + label.widthMm).toBeLessThanOrEqual(paper.widthMm);
      expect(label.yMm + label.heightMm).toBeLessThanOrEqual(paper.heightMm);
    }
  });

  it('supports Letter paper', () => {
    const paper = paperSizeMm('letter');
    expect(paper.widthMm).toBe(215.9);
    expect(paper.heightMm).toBe(279.4);
  });
});
```

- [ ] **Step 3: Implémenter `label-sheet.ts`**

```ts
export type Paper = 'a4' | 'letter';

export interface LabelSheetConfig {
  paper: Paper;
  columns: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  marginXMm: number;
  marginYMm: number;
  gapXMm: number;
  gapYMm: number;
}

export interface LabelPosition {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

const PAPER_MM = {
  a4: { widthMm: 210, heightMm: 297 },
  letter: { widthMm: 215.9, heightMm: 279.4 },
} as const;

export function paperSizeMm(paper: Paper) {
  return PAPER_MM[paper];
}

export function labelPositions(config: LabelSheetConfig): LabelPosition[] {
  const positions: LabelPosition[] = [];
  for (let row = 0; row < config.rows; row++) {
    for (let column = 0; column < config.columns; column++) {
      positions.push({
        xMm: config.marginXMm + column * (config.labelWidthMm + config.gapXMm),
        yMm: config.marginYMm + row * (config.labelHeightMm + config.gapYMm),
        widthMm: config.labelWidthMm,
        heightMm: config.labelHeightMm,
      });
    }
  }
  return positions;
}
```

- [ ] **Step 4: Implémenter `label-icon.ts`**

```ts
import { decodeImageBlob } from '@yoto-community/pixel-editor-core/browser';
import { encodePngDataUrl, type PixelGrid } from '@yoto-community/pixel-editor-core';

export interface LabelIcon {
  grid: PixelGrid;
  dataUrl: string;
}

export async function iconFromFile(file: File): Promise<LabelIcon> {
  const grid = await decodeImageBlob(file);
  return { grid, dataUrl: encodePngDataUrl(grid) };
}
```

- [ ] **Step 5: Vérifier**

```bash
pnpm test
pnpm check:types
```

- [ ] **Step 6: Commit**

```bash
git add site/package.json site/src/lib pnpm-lock.yaml
git commit -m "feat(labels): add label sheet geometry and core icon helpers"
```

---

### Tâche 9 : Portail — page label generator et impression

**Files:**

- Create: `site/src/views/LabelGeneratorView.astro`
- Create: `site/src/pages/myo/labels/index.astro`
- Create: `site/src/pages/fr/myo/labels/index.astro`
- Create: `site/src/scripts/label-generator.ts`
- Create: `site/src/styles/label.css`
- Modify: `site/src/i18n/en.ts`, `site/src/i18n/fr.ts`
- Modify: `site/src/views/MyoView.astro` (lien vers `/myo/labels/`)
- Modify: `scripts/check-search.ts`
- Create: `site/e2e/labels.spec.ts`

**Interfaces:**

- Consumes: `label-sheet.ts`, `label-icon.ts`.
- Produces: page `/myo/labels/` avec upload, aperçu 10 labels, impression/PDF navigateur.

- [ ] **Step 1: Ajouter les clés i18n**

Ajouter dans `en.ts` et `fr.ts` :

```ts
'labels.title': 'Printable card labels',
'labels.lede': 'Add a child name and a 16×16 icon, then print a 10-up sheet.',
'labels.name': 'Child name',
'labels.cardTitle': 'Card title (optional)',
'labels.icon': 'Icon',
'labels.upload': 'Upload an image',
'labels.paper': 'Paper',
'labels.a4': 'A4',
'labels.letter': 'Letter',
'labels.print': 'Print / Save as PDF',
'labels.calibration': 'Print calibration sheet',
'labels.privacy': 'Everything stays in your browser.',
'labels.editIcon': 'Edit icon pixel by pixel',
```

Et les clés françaises correspondantes :

```ts
'labels.title': 'Labels de cartes à imprimer',
'labels.lede': 'Ajoutez un prénom et une icône 16×16, puis imprimez une planche de 10 labels.',
'labels.name': 'Prénom de l’enfant',
'labels.cardTitle': 'Titre de la carte (optionnel)',
'labels.icon': 'Icône',
'labels.upload': 'Importer une image',
'labels.paper': 'Papier',
'labels.a4': 'A4',
'labels.letter': 'Letter',
'labels.print': 'Imprimer / Enregistrer en PDF',
'labels.calibration': 'Imprimer la feuille de calibration',
'labels.privacy': 'Tout reste dans votre navigateur.',
'labels.editIcon': 'Modifier l’icône pixel par pixel',
```

- [ ] **Step 2: Créer la vue**

`LabelGeneratorView.astro` doit contenir :

- un formulaire (nom, titre, upload, papier) ;
- une planche `.label-sheet` avec 10 `.label-card` ;
- un bouton « Imprimer / Enregistrer en PDF » ;
- un bouton « Imprimer la feuille de calibration » ;
- une mention de confidentialité ;
- un conteneur pour l’éditeur React (Tâche 10).

Le script `label-generator.ts` :

```ts
import { encodePngDataUrl } from '@yoto-community/pixel-editor-core';
import { iconFromFile } from '../lib/label-icon';
import { labelPositions, paperSizeMm, type LabelSheetConfig } from '../lib/label-sheet';

const config: LabelSheetConfig = {
  paper: 'a4',
  columns: 2,
  rows: 5,
  labelWidthMm: 90,
  labelHeightMm: 48,
  marginXMm: 10,
  marginYMm: 10,
  gapXMm: 4,
  gapYMm: 4,
};

function render() {
  const sheet = document.querySelector<HTMLElement>('[data-label-sheet]');
  const template = document.querySelector<HTMLTemplateElement>('[data-label-template]');
  if (!sheet || !template) return;

  sheet.replaceChildren(
    ...labelPositions(config).map((position) => {
      const node = template.content.cloneNode(true) as DocumentFragment;
      const card = node.querySelector<HTMLElement>('.label-card');
      const image = node.querySelector<HTMLImageElement>('img');
      const nameNode = node.querySelector<HTMLElement>('[data-label-name]');
      const titleNode = node.querySelector<HTMLElement>('[data-label-title]');
      if (card) {
        card.style.left = `${position.xMm}mm`;
        card.style.top = `${position.yMm}mm`;
        card.style.width = `${position.widthMm}mm`;
        card.style.height = `${position.heightMm}mm`;
      }
      if (image && iconDataUrl) image.src = iconDataUrl;
      if (nameNode) nameNode.textContent = name;
      if (titleNode) titleNode.textContent = title;
      return node;
    }),
  );

  const pageStyle = document.querySelector<HTMLStyleElement>('#label-page-size');
  if (pageStyle) {
    pageStyle.textContent = `@page { size: ${config.paper === 'a4' ? 'A4' : 'letter'}; margin: 0; }`;
  }

  const paper = paperSizeMm(config.paper);
  sheet.style.width = `${paper.widthMm}mm`;
  sheet.style.height = `${paper.heightMm}mm`;
}

let iconDataUrl: string | null = null;
let name = '';
let title = '';

const nameInput = document.querySelector<HTMLInputElement>('[data-label-name-input]');
const titleInput = document.querySelector<HTMLInputElement>('[data-label-title-input]');
const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
const paperInput = document.querySelector<HTMLSelectElement>('[data-label-paper]');
const printButton = document.querySelector<HTMLButtonElement>('[data-label-print]');

nameInput?.addEventListener('input', () => {
  name = nameInput.value;
  render();
});

titleInput?.addEventListener('input', () => {
  title = titleInput.value;
  render();
});

fileInput?.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const icon = await iconFromFile(file);
  iconDataUrl = icon.dataUrl;
  render();
});

paperInput?.addEventListener('change', () => {
  config.paper = paperInput.value === 'letter' ? 'letter' : 'a4';
  render();
});

printButton?.addEventListener('click', () => {
  window.print();
});

render();
```

La vue doit fournir un `<template data-label-template>` avec un `.label-card`, une image et les emplacements `[data-label-name]` / `[data-label-title]`, ainsi qu’une balise `<style id="label-page-size">`.

- [ ] **Step 3: CSS d’impression**

`site/src/styles/label.css` :

```css
.label-sheet {
  position: relative;
  width: 210mm;
  height: 297mm;
  box-sizing: border-box;
  background: white;
  color: black;
}

.label-card {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 4mm;
  border: 0.2mm dashed #ccc;
  overflow: hidden;
  box-sizing: border-box;
}

.label-card img {
  width: 16mm;
  height: 16mm;
  image-rendering: pixelated;
}

@media print {
  /* @page est injecté dynamiquement dans #label-page-size (A4 ou Letter). */
  header,
  footer,
  nav,
  .no-print {
    display: none !important;
  }
  .label-sheet {
    border: none;
  }
  .label-card {
    border: none;
  }
}
```

Le script met à jour `@page { size: A4/letter; }` selon le papier choisi.

- [ ] **Step 4: Créer les routes**

`site/src/pages/myo/labels/index.astro` et `site/src/pages/fr/myo/labels/index.astro` avec `Base`, `LabelGeneratorView`, `path="/myo/labels/"`.

- [ ] **Step 5: Ajouter le lien depuis le guide MYO**

Dans `MyoView.astro`, à l’étape 5, ajouter :

```astro
<a href={localePath(lang, '/myo/labels/')}>{lang === 'fr' ? 'Générer les labels' : 'Generate the labels'}</a>
```

- [ ] **Step 6: Mettre à jour `check-search.ts`**

Ajouter :

```ts
'myo/labels/index.html',
'fr/myo/labels/index.html',
```

- [ ] **Step 7: E2E**

`site/e2e/labels.spec.ts` :

```ts
import { expect, test } from '@playwright/test';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

test('generates ten labels and prints them', async ({ page }) => {
  await page.goto('/myo/labels/');
  await page.getByLabel('Child name').fill('Mila');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'icon.png',
    mimeType: 'image/png',
    buffer: PNG_1X1,
  });

  await expect(page.locator('.label-card')).toHaveCount(10);
  await expect(page.locator('.label-card').first()).toContainText('Mila');

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('header')).toBeHidden();
  await expect(page.locator('.label-sheet')).toBeVisible();
});
```

- [ ] **Step 8: Vérifier**

```bash
pnpm verify
pnpm test
pnpm --filter site test:e2e
```

- [ ] **Step 9: Commit**

```bash
git add site/src site/e2e scripts/check-search.ts
git commit -m "feat(labels): add printable 10-up label generator"
```

---

### Tâche 10 : Portail — éditeur React à la demande

**Files:**

- Modify: `site/package.json`
- Modify: `site/astro.config.mjs`
- Create: `site/src/components/IconEditorMount.astro`
- Create: `site/src/styles/editor-theme.css`
- Modify: `site/src/scripts/label-generator.ts`
- Modify: `scripts/check-budget.ts`
- Modify: `site/e2e/labels.spec.ts`

**Interfaces:**

- Consumes: `@yoto-community/pixel-editor-react`, `mountPixelEditor`, `en`, `fr`.
- Produces: édition pixel par pixel, chargée uniquement au clic.

- [ ] **Step 1: Ajouter React et le chunk dédié**

Dans `site/package.json` :

```json
{
  "dependencies": {
    "react": "^19.3.1",
    "react-dom": "^19.3.1",
    "@yoto-community/pixel-editor-react": "^0.1.0"
  },
  "devDependencies": {
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0"
  }
}
```

L’intégration `@astrojs/react` n’est pas nécessaire : l’éditeur est compilé dans le package et monté impérativement avec `mountPixelEditor`. Astro/Vite bundle simplement les imports React du package.

Si 7B, utiliser les URLs de tarball pour `pixel-editor-react`.

Dans `astro.config.mjs` :

```js
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  integrations: [sitemap()],
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'pixel-editor-react': ['react', 'react-dom', '@yoto-community/pixel-editor-react'],
          },
        },
      },
    },
  },
});
```

- [ ] **Step 2: Créer le point de montage**

`IconEditorMount.astro` :

```astro
<div class="icon-editor-mount no-print" data-icon-editor hidden></div>
<button type="button" class="no-print" data-open-icon-editor>
  {t(lang, 'labels.editIcon')}
</button>
<button type="button" class="no-print" data-close-icon-editor hidden>
  {lang === 'fr' ? 'Fermer l’éditeur' : 'Close the editor'}
</button>
```

- [ ] **Step 3: Charger l’éditeur au clic**

Dans `label-generator.ts` :

```ts
const editorButton = document.querySelector<HTMLButtonElement>('[data-open-icon-editor]');
const editorMount = document.querySelector<HTMLElement>('[data-icon-editor]');
const closeEditorButton = document.querySelector<HTMLButtonElement>('[data-close-icon-editor]');
let destroyEditor: (() => void) | null = null;

editorButton?.addEventListener('click', async () => {
  if (destroyEditor) return;

  const { mountPixelEditor, en, fr } = await import('@yoto-community/pixel-editor-react');

  destroyEditor = mountPixelEditor(editorMount!, {
    messages: document.documentElement.lang === 'fr' ? fr : en,
    storageKey: 'yoto-label-editor-draft',
    compact: true,
    onChange: (grid) => {
      iconDataUrl = encodePngDataUrl(grid);
      render();
    },
  });

  editorMount!.hidden = false;
  closeEditorButton!.hidden = false;
});

closeEditorButton?.addEventListener('click', () => {
  destroyEditor?.();
  destroyEditor = null;
  editorMount!.hidden = true;
  closeEditorButton!.hidden = true;
});
```

Ne pas importer le package au niveau supérieur du script : l’import doit rester dynamique.

- [ ] **Step 4: Ajouter le thème**

`site/src/styles/editor-theme.css` :

```css
.pe-theme-yoto {
  --pe-color-text: var(--ink);
  --pe-color-text-muted: var(--ink-muted);
  --pe-color-text-secondary: var(--ink-muted);
  --pe-color-border: var(--border);
  --pe-color-surface: var(--surface);
  --pe-color-surface-muted: var(--surface-2);
  --pe-color-primary: var(--accent);
  --pe-color-primary-dark: var(--accent-strong);
  --pe-color-primary-light: var(--accent-soft);
  --pe-color-text-inverse: var(--bg);
  --pe-space-1: var(--space-1);
  --pe-space-2: var(--space-2);
  --pe-space-3: var(--space-3);
  --pe-space-4: var(--space-4);
  --pe-space-5: var(--space-5);
  --pe-space-6: var(--space-6);
  --pe-radius: var(--radius-sm);
  --pe-text-xs: 0.75rem;
  --pe-text-sm: 0.85rem;
  --pe-text-2xl: 1.5rem;
}
```

Ajouter `pe-theme-yoto` au conteneur et importer `@yoto-community/pixel-editor-react/styles.css`.

- [ ] **Step 5: Exclure le chunk éditeur du budget principal**

Dans `scripts/check-budget.ts`, après la construction de `all` :

```ts
const EDITOR_BUDGET = 120 * 1024;
const isEditor = (entry: Entry) => /pixel-editor-react/i.test(entry.file);
const editor = all.filter(isEditor);
const site = all.filter((entry) => !isEditor(entry));
const total = sum(site);
const editorTotal = sum(editor);

if (editorTotal > EDITOR_BUDGET) {
  console.error(`Pixel editor budget exceeded: ${kb(editorTotal)} KB > ${kb(EDITOR_BUDGET)} KB.`);
  process.exit(1);
}
```

Mettre à jour les logs pour afficher les deux budgets. Le plafond principal reste 30 Ko.

- [ ] **Step 6: E2E**

Ajouter dans `site/e2e/labels.spec.ts` :

```ts
test('loads the pixel editor only on demand', async ({ page }) => {
  const editorRequests: string[] = [];
  page.on('request', (request) => {
    if (/pixel-editor-react/i.test(request.url())) editorRequests.push(request.url());
  });

  await page.goto('/myo/labels/');
  expect(editorRequests).toHaveLength(0);

  await page.getByRole('button', { name: /edit icon/i }).click();
  await expect(page.locator('.pixel-editor')).toBeVisible();
  expect(editorRequests.length).toBeGreaterThan(0);
});
```

- [ ] **Step 7: Vérifier**

```bash
pnpm verify
pnpm test
pnpm --filter site test:e2e
```

Expected: budget principal sous 30 Ko, budget éditeur sous 120 Ko, éditeur chargé uniquement après clic.

- [ ] **Step 8: Commit**

```bash
git add site scripts/check-budget.ts
git commit -m "feat(labels): load the pixel editor on demand"
```

---

### Tâche 11 : Documentation et nettoyage

**Files:**

- Modify: `../icons-catalogue/README.md`
- Create: `../icons-catalogue/packages/pixel-editor-core/README.md`
- Create: `../icons-catalogue/packages/pixel-editor-react/README.md`
- Modify: `docs/launch-checklist.md` (portail, route `/myo/labels/`)
- Modify: `CONTRIBUTING.md` si les commandes changent

- [ ] **Step 1: Documenter le monorepo**

README icons-catalogue :

```bash
pnpm install
pnpm --filter site run dev
pnpm --filter @yoto-community/pixel-editor-core test
pnpm --filter @yoto-community/pixel-editor-react test
pnpm changeset
```

- [ ] **Step 2: Documenter les packages**

Chaque README doit contenir :

- installation ;
- exemple d’import ;
- API publique ;
- licence MIT ;
- lien vers le dépôt.

- [ ] **Step 3: Documenter le portail**

Ajouter `/myo/labels/` et `/fr/myo/labels/` à la checklist de lancement et au parcours MYO.

- [ ] **Step 4: Nettoyage final**

```bash
cd ../icons-catalogue
grep -R "site/src/components/editor\|site/src/hooks/usePixelEditor" . --exclude-dir=node_modules --exclude-dir=dist
```

Expected: aucune sortie.

- [ ] **Step 5: Commit**

```bash
git add README.md packages/*/README.md
git commit -m "docs: document the pixel editor packages and label generator"
```

---

### Tâche 12 : Vérification finale

**Files:** aucun nouveau fichier.

- [ ] **Step 1: Vérifier le monorepo**

```bash
cd ../icons-catalogue
pnpm install --frozen-lockfile
pnpm --filter @yoto-community/pixel-editor-core test
pnpm --filter @yoto-community/pixel-editor-core build
pnpm --filter @yoto-community/pixel-editor-react test
pnpm --filter @yoto-community/pixel-editor-react build
pnpm --filter site run verify
pnpm --filter site run test:e2e
```

Expected: toutes les commandes passent ; `/editor` fonctionne.

- [ ] **Step 2: Vérifier le portail**

```bash
cd ../yoto-community.github.io
pnpm install --frozen-lockfile
pnpm verify
pnpm test
pnpm --filter site test:e2e
pnpm audit --audit-level=high
```

Expected: `pnpm verify` passe, le budget principal reste sous 30 Ko, le budget éditeur est respecté, l’E2E labels/éditeur passe.

- [ ] **Step 3: Vérifier l’absence de duplication**

```bash
cd ../icons-catalogue
grep -R "function editorReducer\|function encodePngDataUrl\|function floodFill" site/src packages --exclude-dir=node_modules --exclude-dir=dist
```

Expected: une seule implémentation, dans `packages/pixel-editor-core`.

- [ ] **Step 4: Vérifier la publication**

```bash
npm view @yoto-community/pixel-editor-core version
npm view @yoto-community/pixel-editor-react version
```

Expected: `0.1.0` (ou les assets de release existent en 7B).

- [ ] **Step 5: Commit final**

```bash
git status
git add .
git commit -m "chore: verify the pixel editor extraction"
```

---

## 5. Matrice de vérification

| Vérification         | Commande                                                                                  | Critère                             |
| -------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------- |
| Workspace unique     | `test -f icons-catalogue/pnpm-lock.yaml && test ! -f icons-catalogue/site/pnpm-lock.yaml` | OK                                  |
| Core isolé           | `pnpm --filter @yoto-community/pixel-editor-core build`                                   | OK                                  |
| Tests core           | `pnpm --filter @yoto-community/pixel-editor-core test`                                    | 100 % des tests passent             |
| Tests React          | `pnpm --filter @yoto-community/pixel-editor-react test`                                   | 100 % des tests passent             |
| Catalogue            | `pnpm --filter site run verify`                                                           | OK                                  |
| `/editor`            | `pnpm --filter site run test:e2e`                                                         | OK                                  |
| Portail              | `pnpm verify`                                                                             | OK                                  |
| Budget principal     | `pnpm check:budget`                                                                       | < 30 Ko gzip                        |
| Budget éditeur       | `pnpm check:budget`                                                                       | < 120 Ko gzip                       |
| Pas de React initial | E2E labels                                                                                | 0 requête `pixel-editor` avant clic |
| Éditeur à la demande | E2E labels                                                                                | éditeur visible après clic          |
| Publication          | `npm view ...`                                                                            | `0.1.0`                             |
| Pas de duplication   | `grep`                                                                                    | une seule implémentation            |

---

## 6. Risques et mitigations

| Risque                         | Mitigation                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Unification des deux lockfiles | Faire la Tâche 1 seule dans un PR, sans déplacement de code.                                               |
| Version pnpm 12 vs 10          | Le monorepo utilise `pnpm@12.4.2` ; le portail reste sur 10.11.0 ; les packages publiés sont indépendants. |
| Build Pages cassé              | Adapter `deploy-pages.yml` et vérifier `site/dist` avant de merger.                                        |
| CSS incohérent                 | Variables `--pe-*` + thème par app + test visuel.                                                          |
| i18n dupliquée                 | Un dictionnaire `editor` par langue dans le package, injecté par les apps.                                 |
| Clé `localStorage` partagée    | `storageKey` obligatoire ; test dédié.                                                                     |
| Poids React                    | Chargement dynamique + budget séparé + E2E sans requête initiale.                                          |
| Publication npm impossible     | Plan B : tarballs GitHub Releases.                                                                         |
| Divergence entre apps          | Une seule source de vérité : `packages/*` ; supprimer les copies locales.                                  |
| API instable                   | Versionner en `0.x`, Changesets, README d’API.                                                             |

---

## 7. Rollback

- **Tâche 1** : `git revert` du commit de monorepo ; restaurer `site/pnpm-lock.yaml` et `site/pnpm-workspace.yaml`.
- **Tâches 2–6** : les packages sont additifs ; on peut revenir aux imports locaux tant que les fichiers d’origine sont dans l’historique Git.
- **Tâche 7** : dépublier n’est pas possible sur npm ; publier un correctif `0.1.1`. En 7B, supprimer la release.
- **Tâches 8–10** : la page `/myo/labels/` est isolée ; la retirer des routes et du sitemap si nécessaire.
- Ne jamais supprimer les fichiers d’origine avant que les tests du package et du site passent.

---

## 8. Hors périmètre

- Réécriture de l’éditeur en Web Component.
- Support d’autres tailles de grille que 16×16.
- Génération PDF directe (le MVP utilise l’impression navigateur).
- Upload d’icônes vers un serveur.
- Comptes utilisateurs, favoris serveur, analytics.
- Modification du catalogue d’icônes lui-même (recherche, scraping, PWA).

---

## 9. Prochaine étape

1. Trancher la décision de publication (7A npm ou 7B tarballs).
2. Exécuter les tâches dans l’ordre, avec un PR par grande étape :
   - PR 1 : Tâche 1 (monorepo).
   - PR 2 : Tâches 2–4 (core + Changesets).
   - PR 3 : Tâches 5–6 (React + migration du site).
   - PR 4 : Tâche 7 (publication).
   - PR 5 : Tâches 8–9 (label generator core).
   - PR 6 : Tâche 10 (éditeur lazy).
   - PR 7 : Tâches 11–12 (docs + vérification).
3. Ne pas mélanger l’unification du monorepo et l’extraction du code dans le même PR.
