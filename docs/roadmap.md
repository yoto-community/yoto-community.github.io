# Roadmap du portail Yoto Community

- **Statut** : proposition à valider
- **Date** : 2026-11-06
- **Périmètre** : `https://yoto-community.github.io/` (portail horizontal), avec les
  catalogues `icons-catalogue` et `podcast-catalogue` comme dépendances.
- **Contrainte non négociable** : 100 % statique, GitHub Pages, aucun backend, aucun
  compte, aucune analytics tierce.

Ce document priorise les fonctionnalités, puis détaille la première vague au niveau
tâche. Si la vague 1 est validée, elle sera convertie en plan d'exécution TDD
(bite-sized tasks) avant toute modification de code.

---

## 1. Point de départ

Le portail fait déjà beaucoup :

- 58 projets curés, 9 catégories, 28 tags contrôlés, 4 collections éditoriales.
- Liste filtrable et triable, état dans l'URL, fiches projet avec alternatives.
- Recherche Pagefind bilingue, guides MYO en 5 étapes, éditeur d'icônes 16×16.
- API JSON statique (`catalog.json`, `projects.json`, `categories.json`, `changelog.json`).
- Signaux de maintenance : étoiles, dernier commit, statuts `stale`/`archived`/`deprecated`,
  enrichissement GitHub nocturne, vérification hebdomadaire des liens.
- Bilingue EN/FR, SEO (sitemap, JSON-LD, OG), accessibilité testée, budget JS < 30 Ko.

Les vraies faiblesses ne sont pas techniques. Elles sont produit :

1. **Le portail est un annuaire, pas encore un outil de décision.** Un parent face à
   13 outils de création de cartes ne sait pas lequel choisir. Les filtres supposent
   de connaître le vocabulaire (tags, plateformes, prérequis).
2. **Le signal de maintenance est sous-exploité.** Un lien mort n'apparaît que dans
   une issue GitHub ; aucune fiche ne dit « vérifié le ». C'est pourtant la promesse
   qui différencie Awesome Yoto d'une simple awesome-list.
3. **La racine n'est pas la porte d'entrée de l'écosystème.** Pagefind n'indexe que le
   portail. Les 27 271 icônes et les 198 podcasts sont à un autre sous-chemin, sans
   recherche unifiée. `playlist-catalogue` n'est même pas encore déployé.
4. **La même origine est sous-exploitée.** `/icons-catalogue/` et
   `/podcast-catalogue/` partagent l'origine `yoto-community.github.io`, donc le même
   `localStorage`. Or chaque site a ses propres clés (`yoto-icons-favorites`,
   `yoto-favorites`, `yoto-icons-theme`, `locale`) : rien n'est partagé, et la clé
   `locale` est même assez générique pour entrer en collision. Les favoris, une
   « trousse » et des préférences pourraient pourtant être communs sans compte.
5. **Contribuer = ajouter.** Il n'existe pas de chemin « corriger une fiche » ou
   « ce projet est le mien ».
6. **Le FR est incomplet.** Mesure au 2026-11-06 : **45 des 58 fiches (78 %) n'ont pas
   de `descriptionFr`** et retombent sur l'anglais, avec un badge « EN » discret. Les
   trois coups de cœur sont traduits, mais pas des fiches très visibles comme
   `yoto-card-studio`, `yoto-app`, `custom-yoto-cards` ou `yoto-cli`. Les routes et les
   chaînes d'interface sont, elles, à parité (test CI).

---

## 2. Features candidates

Notation : impact sur les trois objectifs du projet (découverte, confiance,
guidage) × effort. `S` ≈ 1–2 j, `M` ≈ 3–5 j, `L` ≈ 1–2 sem.

| #   | Feature                                              | Problème résolu                                                          | Impact | Effort | Vague |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------ | ------ | ------ | ----- |
| 1   | **« Quel outil pour moi ? »** (chooser)              | 58 entrées, aucun choix guidé ; les filtres exigent le bon vocabulaire   | ★★★★★  | M      | 1     |
| 2   | **Santé des liens visible**                          | La promesse « maintenance » n'apparaît pas sur les fiches                | ★★★★   | S      | 1     |
| 3   | **Écosystème en chiffres + nouveautés**              | Le portail ne reflète pas les 27 k icônes / 198 podcasts                 | ★★★    | S      | 1     |
| 4   | **Corriger une fiche en un clic**                    | Contribution limitée à l'ajout, pas de boucle de correction              | ★★★    | S      | 1     |
| 5   | **Recherche unifiée inter-catalogues**               | La racine ne cherche que le portail, pas l'écosystème                    | ★★★★★  | M      | 2     |
| 6   | **Guides par usage** (YouTube, livres audio, backup) | Un seul parcours MYO, pas de parcours par source                         | ★★★★★  | M      | 2     |
| 7   | **Pages tags + « alternatives à X »**                | Longue traîne SEO, découverte par intention                              | ★★★    | S/M    | 2     |
| 8   | **Favoris / trousse partagée** (localStorage)        | Aucune rétention ; même origine inexploitée ; contrat à poser en vague 0 | ★★★★   | M/L    | 2     |
| 9   | **`llms.txt` + API versionnée + schémas**            | Distribution vers les développeurs et les assistants IA                  | ★★★    | S      | 3     |
| 10  | **Digest « nouveaux / mis à jour » + badge**         | Distribution et preuve sociale                                           | ★★     | S      | 3     |
| 11  | **PWA + palette ⌘K + bascule de thème**              | Confort, usage hors ligne du guide MYO                                   | ★★     | M      | 3     |
| 12  | **FR complet (58 descriptions, puis guides)**        | 45/58 fiches retombent sur l'anglais                                     | ★★★★   | S      | 0     |

### Les trois features les plus intéressantes

1. **Le chooser (#1)** — c'est le seul ajout qui change la nature du site : on passe
   d'une liste qu'il faut savoir lire à un outil qui répond à « je veux faire une
   carte YouTube sur Mac, je ne sais pas coder ». Aucun concurrent ne le fait.
2. **La recherche unifiée (#5)** — le domaine racine doit être la porte d'entrée. Une
   requête doit mener aux projets, aux icônes et aux podcasts, pas seulement aux
   fiches du portail.
3. **La santé visible (#2)** — c'est la promesse fondatrice et elle coûte peu : les
   données existent déjà, il manque 3 composants et un fichier généré.

Les **guides (#6)** sont le multiplicateur de contenu : ils transforment le chooser et
les fiches en parcours complets, et captent la longue traîne (« convertir YouTube en
carte Yoto »). Ils demandent surtout de la rédaction, pas de l'ingénierie.

---

## 3. Séquence recommandée

### Vague 0 — « Dettes visibles » (≈ 1 jour)

- **FR complet** : 45 descriptions manquantes, glossaire, chemin de contribution et
  verrou anti-régression (voir 4.5).
- **Contrat same-origin** : documenter le format `yoto-community:*` et les règles de
  migration, sans encore construire la trousse (voir 4.6).
- **Lien « Modifier sur GitHub »** sur chaque fiche : le chemin de contribution le
  moins cher qui existe.

**Pourquoi avant tout** : ce sont des dettes déjà visibles par les visiteurs. Elles
coûtent peu, ne dépendent d'aucune décision produit, et évitent de traduire ou de
ré-écrire les fiches après les avoir retouchées pour les guides. La vague 0 peut être
livrée en parallèle de la vague 1.

### Vague 1 — « Décider et faire confiance » (≈ 2 semaines)

- Chooser guidé + résultats partageables.
- Santé des liens et fraîcheur visibles sur les cartes et les fiches.
- Correction d'une fiche en un clic.
- Bandeau écosystème (chiffres des catalogues) + nouveautés sur l'accueil.

**Pourquoi d'abord** : impact utilisateur immédiat, zéro dépendance externe, aucun
changement de modèle de données obligatoire. Le portail devient utile avant d'être
plus grand.

### Vague 2 — « Découvrir et retenir » (≈ 3–4 semaines)

- Recherche unifiée portail + icônes + podcasts (handoff, pas de fusion d'index).
- 3 guides par usage, réutilisant le chooser et les fiches.
- Pages `/tags/<tag>/` et `/alternatives/<slug>/` générées.
- Trousse locale partagée entre le portail et les catalogues (même origine), avec
  export/import et impression. Démarrage portail-only, puis miroir côté icônes.

**Pourquoi ensuite** : ces features dépendent soit du chooser (guides), soit d'un
accord inter-dépôts (trousse). Elles demandent aussi plus de contenu éditorial.

### Vague 3 — « Distribuer et durcir » (continu)

- `llms.txt`, schémas JSON publics, politique de version de l'API, badge
  « Listed on Awesome Yoto ».
- Digest mensuel (JSON + RSS existant) et section « nouveaux ce mois-ci ».
- PWA légère (guide MYO hors ligne), palette de commandes, bascule de thème.
- Traduction des guides et des pages éditoriales (les descriptions de fiches sont
  traitées en vague 0).

### Ce qu'on ne fait pas (YAGNI)

- Comptes, votes, commentaires, newsletter, base de données, backend.
- Chatbot IA générique : coût, latence, modération, contraire à la contrainte statique.
- Hébergement ou miroir d'audio, contournement de DRM, revente de cartes.
- Recherche plein texte des 27 k icônes **dans** le portail : le catalogue d'icônes le
  fait déjà mieux ; on délègue avec `?q=`.
- Serveur MCP : nécessite un runtime. On publie `llms.txt` et l'API à la place.

---

## 4. Plans détaillés — Vagues 0 et 1

Les sections **4.1 à 4.4** détaillent la vague 1. Les sections **4.5 et 4.6**
détaillent la vague 0, qui peut être livrée en parallèle.

### 4.1 Choiser : « Quel outil pour ma carte ? »

**Objectif** : en 3 réponses, obtenir 1 outil recommandé + 2 alternatives, avec la
raison du choix et un lien vers la fiche et l'étape MYO correspondante.

**Parcours cible**

1. « Que voulez-vous faire ? » — YouTube → carte, fichiers audio → carte,
   podcast → carte, livre audio → carte, sauvegarder une carte, automatiser,
   développer.
2. « Sur quel appareil ? » — Web, Windows, macOS, Android, iOS, Linux,
   auto-hébergé, peu importe.
3. « Quel niveau ? » — « Je ne veux rien installer » / « Je suis à l'aise avec un
   terminal ».

**Résultat** : 1 recommandation + 2 alternatives, badge de statut, raison lisible
(« correspond à YouTube », « fonctionne sur macOS », « aucune installation »), lien
`/p/<slug>/`, lien vers l'étape MYO et vers `/projects/` avec les filtres pré-remplis.
URL partageable : `/chooser/?goal=youtube&platform=macos&level=simple`.

**Données et logique**

- V1 dérive tout de l'existant : `category`, `tags`, `platforms`, `requires`,
  `warning`, `status`, `meta.stars`. **Aucune migration des 58 YAML.**
- La configuration des objectifs vit dans `site/src/lib/chooser.ts` (même pattern que
  les étapes codées dans `MyoView.astro`).
- Si les résultats sont décevants sur 6 personas, ajouter un champ optionnel
  `bestFor` au schéma projet — pas avant.

**Décisions prises (2026-11-06)**

- Le build est statique : `Astro.url.search` est vide au build, donc les résultats sont
  rendus côté client à partir de l'URL. Sans JS, la page conserve la liste statique des
  outils de création et les liens de filtres par objectif (conforme aux critères).
- `web` et `cli` comptent comme disponibles sur Windows, macOS et Linux ; iOS et Android
  ne correspondent qu'à leur plateforme exacte ; `self-hosted` exige le prérequis
  homonyme ; « peu importe » ne donne aucun bonus de plateforme.
- Le bonus de plateforme ne s'applique qu'aux projets déjà pertinents pour l'objectif
  (catégorie ou tag). Sans cette garde, choisir une plateforme remplissait la liste
  d'outils hors sujet.
- Le mode simple pénalise une fois les prérequis `yoto-api-key`/`self-hosted`, la
  plateforme `cli` et l'avertissement `experimental`.
- Pas de champ `bestFor` : les 6 personas passent sur les données existantes
  (`tests/chooser-personas.test.ts`). Le score reste centralisé dans `chooser.ts`.
- Pas de remplissage artificiel : si une catégorie a moins de 3 outils éligibles, le
  chooser affiche moins de 3 résultats plutôt qu'un outil hors sujet.

```ts
// site/src/lib/chooser.ts — extrait tel qu'implémenté
export type Goal =
  'youtube' | 'files' | 'podcast' | 'audiobook' | 'backup' | 'automate' | 'develop';
export type Level = 'simple' | 'advanced';

export interface ChooserState {
  goal: Goal;
  platform: Platform | 'any';
  level: Level;
}

const GOAL_RULES: Record<Goal, { categories: string[]; tags: string[] }> = {
  youtube: { categories: ['create'], tags: ['youtube', 'myo'] },
  files: { categories: ['create'], tags: ['myo', 'audiobook'] },
  podcast: { categories: ['audio'], tags: ['podcast', 'rss'] },
  audiobook: { categories: ['audio', 'create'], tags: ['audiobook'] },
  backup: { categories: ['backup'], tags: [] },
  automate: { categories: ['automate'], tags: [] },
  develop: { categories: ['develop'], tags: [] },
};

const ADVANCED_REQUIRES = new Set(['yoto-api-key', 'self-hosted']);

function worksOn(project: ChooserProject, platform: ChooserPlatform): boolean {
  if (platform === 'any') return true;
  if (platform === 'self-hosted') return project.requires?.includes('self-hosted') ?? false;
  if (project.platforms.includes(platform)) return true;
  if (['windows', 'macos', 'linux'].includes(platform)) {
    return project.platforms.includes('web') || project.platforms.includes('cli');
  }
  return false;
}

function isAdvanced(project: ChooserProject): boolean {
  return (
    (project.requires?.some((requirement) => ADVANCED_REQUIRES.has(requirement)) ?? false) ||
    project.platforms.includes('cli') ||
    project.warning === 'experimental'
  );
}

export function scoreProject(project: ChooserProject, state: ChooserState): number {
  const rule = GOAL_RULES[state.goal];
  const goalRelevant =
    rule.categories.includes(project.category) ||
    project.tags.some((tag) => rule.tags.includes(tag));
  let score = 0;
  if (rule.categories.includes(project.category)) score += 4;
  score += project.tags.filter((tag) => rule.tags.includes(tag)).length * 3;
  if (goalRelevant && state.platform !== 'any' && worksOn(project, state.platform)) score += 3;
  if (project.status === 'stale') score -= 5;
  if (state.level === 'simple' && isAdvanced(project)) score -= 3;
  return score;
}
```

Source de vérité : site/src/lib/chooser.ts.

**Fichiers**

- Créer : `site/src/lib/chooser.ts`, `site/src/lib/chooser.test.ts`,
  `site/src/views/ChooserView.astro`, `site/src/pages/chooser.astro`,
  `site/src/pages/fr/chooser.astro`, `site/src/scripts/chooser.ts`,
  `site/e2e/chooser.spec.ts`.
- Modifier : `site/src/i18n/en.ts`, `site/src/i18n/fr.ts`, `site/src/components/Header.astro`,
  `site/src/views/HomeView.astro`, `site/src/views/MyoView.astro` (CTA « Choisir mon
  outil »), `site/src/lib/routes.ts` si une route nommée est utile.

**Tâches**

- [x] **T1 — Logique pure + tests unitaires.** `recommendProjects(projects, state, limit = 3)`
      filtre les `deprecated`/`archived`, score, trie par score puis étoiles puis nom,
      ne complète jamais avec des projets hors sujet : moins de 3
      résultats est un résultat valide.
      Cas de test : youtube/web/simple → `louis` en tête ; backup → outils de backup ;
      develop → outils dev ; audiobook/macos → outil compatible ; aucun résultat →
      repli explicite ; projet `experimental` pénalisé en mode simple.
- [x] **T2 — Vue serveur + fallback sans JS.** `ChooserView` rend les 3 questions, la
      liste statique des outils de création (utile sans JS) et les résultats si l'URL
      contient déjà un état. Les `<a>` vers `/projects/?cat=create&tag=youtube` sont
      générés côté serveur.
- [x] **T3 — Amélioration progressive.** `scripts/chooser.ts` gère les clics, met à
      jour l'URL (`replaceState`), annonce les résultats dans une zone `aria-live`,
      déplace le focus sur le titre des résultats, et laisse le formulaire fonctionner
      sans JS (`<form method="get">`).
- [x] **T4 — i18n + navigation.** Ajouter les clés EN/FR, un lien « Choisir un outil »
      dans le header et un CTA secondaire dans le hero de l'accueil.
- [x] **T5 — E2E + a11y.** Playwright : 3 clics → résultat visible → URL partageable →
      rechargement avec la même URL → mêmes résultats ; axe sans erreur critique ;
      `check:budget` toujours vert (script client < 6 Ko gzip).
- [x] **T6 — Contenu.** Vérifier 6 personas réels (parent non technique, utilisateur
      Windows, utilisateur Mac, auto-hébergeur, développeur, sauvegarde) et ajuster
      les règles ou les textes. Documenter les règles dans ce fichier.

**Critères d'acceptation**

- 3 interactions maximum, résultat en moins de 50 ms côté client.
- URL partageable et rechargée à l'identique ; retour arrière fonctionnel.
- Sans JS : la liste statique et les liens de filtres restent utilisables.
- Aucun projet `deprecated` ou `archived` recommandé.
- Chaque recommandation affiche une raison compréhensible, pas un score.

**Risques**

- Recommandations perçues comme arbitraires → toujours afficher la raison + un lien
  « signaler une erreur » (voir 4.3) + tests personas.
- Dérive du vocabulaire des tags → les règles sont centralisées dans un seul fichier.

---

### 4.2 Santé des projets : liens morts et fraîcheur

**Objectif** : qu'un visiteur voie sur la fiche et la carte qu'un lien est cassé ou
qu'un projet n'a pas bougé depuis 18 mois, sans ouvrir GitHub.

**Données**

- Nouveau fichier généré `data/.meta-links.json` (même cycle que `.meta.json`) :

```json
{
  "checkedAt": "2026-11-06",
  "projects": {
    "louis": { "url": "ok", "repo": "ok" },
    "toto-backup": { "url": "dead", "repo": "ok" }
  }
}
```

- `scripts/check-links.ts` écrit ce fichier en plus de `link-report.md`.
  `buildTargets` doit renvoyer les **slugs** en plus des noms.
- `scripts/lib/load.ts` fusionne les deux métafichiers :

```ts
meta: {
  ...cache.projects[slug],
  links: linkCache.projects[slug],
  linksCheckedAt: linkCache.checkedAt,
}
```

- Étendre `ProjectMeta` (`scripts/lib/types.ts`) :

```ts
export type LinkState = 'ok' | 'dead';
export interface ProjectMeta {
  stars?: number;
  lastCommit?: string;
  archived?: boolean;
  licenseDetected?: string;
  links?: { url?: LinkState; repo?: LinkState };
  linksCheckedAt?: string;
}
```

**Fichiers**

- Modifier : `scripts/lib/types.ts`, `scripts/lib/links.ts`, `scripts/check-links.ts`,
  `scripts/lib/load.ts`, `scripts/lib/catalog.ts` (si nécessaire),
  `site/src/components/ProjectCard.astro`, `site/src/views/ProjectView.astro`,
  `site/src/lib/filter.ts`, `site/src/scripts/filters.ts`,
  `site/src/components/FilterBar.astro`, `site/src/i18n/en.ts`, `site/src/i18n/fr.ts`,
  `.github/workflows/pages.yml`.
- Créer : `tests/link-meta.test.ts`, `site/src/components/HealthBadge.astro`.

**Tâches**

- [ ] **T1 — Mapping lien → slug.** Modifier `buildTargets` pour retourner
      `Map<string, string[]>` de slugs ; test unitaire avec deux projets partageant
      une URL.
- [ ] **T2 — Écriture du fichier.** `check-links.ts` agrège par slug (`url`/`repo`),
      écrit `data/.meta-links.json` avec la date, et continue de produire
      `link-report.md`. En cas d'échec réseau, `dead` est écrit mais l'UI affiche la
      date de vérification pour éviter de condamner un lien temporairement indisponible.
- [ ] **T3 — Fusion au build.** `createLoader().meta()` lit `.meta-links.json` s'il
      existe ; absence = pas de badge (pas d'erreur). Test de build avec et sans fichier.
- [ ] **T4 — Badge et fiche.** `ProjectCard` affiche un badge discret « lien mort »
      (danger) si `meta.links.url === 'dead'` ; `ProjectView` ajoute une ligne
      « Liens vérifiés le <date> » et le statut par URL. Le bloc `deprecatedBy` existant
      devient un encart proéminent avec lien vers la fiche du remplaçant si elle est
      dans le catalogue.
- [ ] **T5 — Filtre santé.** Ajouter `health=dead` à `FilterState`, un contrôle dans
      `FilterBar` et la logique correspondante dans `filterProjects`. Tester
      `parseFilters`/`serializeFilters`/`filterProjects`.
- [ ] **T6 — CI nocturne.** Dans `pages.yml`, exécuter `pnpm check:links` avant
      `pnpm build` la nuit (`continue-on-error: true`), pour que le site publié ait des
      données fraîches même si le commit bot est rejeté par la protection de branche.
      Ne jamais bloquer une PR sur un lien temporairement indisponible.

**Critères d'acceptation**

- Un lien mort est visible sur la carte et la fiche, avec la date de vérification.
- Le site se construit sans `.meta-links.json` (mode local / première installation).
- `pnpm check:links` reste non bloquant pour les PR.
- Les tests existants de `filter` et `build` passent.

---

### 4.3 Corriger une fiche en un clic

**Objectif** : sur chaque fiche, un lien « Suggérer une correction » ouvre une issue
pré-remplie avec le slug et le nom du projet.

**Fichiers**

- Créer : `site/src/lib/contribute-links.ts`, `site/src/lib/contribute-links.test.ts`,
  `.github/ISSUE_TEMPLATE/update-project.yml`.
- Modifier : `site/src/views/ProjectView.astro`, `site/src/views/ContributeView.astro`,
  `site/src/i18n/en.ts`, `site/src/i18n/fr.ts`.

**Tâches**

- [ ] **T1 — Générateur d'URL pur.** `updateIssueUrl(project)` et
      `reportLinkUrl(project)` construisent
      `https://github.com/yoto-community/yoto-community.github.io/issues/new?template=…&title=…`.
      Tester l'encodage, les accents et les slugs.
- [ ] **T2 — Formulaire `update-project.yml`.** Champs : slug (pré-rempli par le titre),
      ce qui doit changer, source de la correction. Label `update-request`
      (créer le label ; ne pas réutiliser `app:submission`, qui déclenche la création
      automatique de projet).
- [ ] **T3 — Intégration UI.** Ajouter le lien en pied de fiche et sur `/contribute/`.
      Aucune donnée collectée, aucun formulaire côté site.
- [ ] **T4 — Test E2E.** Vérifier que le lien d'une fiche contient le bon slug et part
      vers le bon template.

**Critères d'acceptation**

- Chaque fiche expose un chemin de correction sans jargon Git.
- Aucun workflow automatique ne confond une correction avec un nouvel ajout.

---

### 4.4 Accueil : chiffres de l'écosystème et nouveautés

**Objectif** : montrer que le portail est la racine d'un écosystème de 27 k icônes et
198 podcasts, et que la liste vit.

**Données**

- Script `scripts/sync-ecosystem.ts` qui lit :
  - `https://yoto-community.github.io/icons-catalogue/summary.json`
    (`total`, `updatedAt`),
  - `https://yoto-community.github.io/podcast-catalogue/dist/index.json`
    (`counts.total`, `counts.byLanguage`, `updatedAt`),
  - plus tard `playlist-catalogue` **quand il sera déployé** (aujourd'hui 404).
- Écrit `data/ecosystem.json`, versionné, avec les valeurs précédentes conservées en
  cas d'échec réseau. Le build lit ce fichier ; **aucun appel réseau au runtime**.
- `playlist-catalogue` reste absent du bandeau tant que l'URL n'est pas live, avec un
  commentaire explicite dans le script.

**Fichiers**

- Créer : `scripts/sync-ecosystem.ts`, `scripts/lib/ecosystem.ts`,
  `tests/ecosystem.test.ts`, `data/ecosystem.json`,
  `site/src/components/EcosystemStats.astro`.
- Modifier : `site/src/views/HomeView.astro`, `.github/workflows/pages.yml`,
  `site/src/i18n/en.ts`, `site/src/i18n/fr.ts`, `package.json` (script
  `sync:ecosystem`).

**Tâches**

- [ ] **T1 — Parseurs purs + fixtures.** `parseIconsSummary(json)` et
      `parsePodcastIndex(json)` valident la forme et retournent
      `{ total, updatedAt }`. Tests avec des fixtures réelles tronquées et des JSON
      invalides.
- [ ] **T2 — Script de synchronisation.** Timeout 5 s, `Promise.allSettled`, écrit le
      fichier seulement si au moins une source répond, sinon conserve l'ancien et sort
      en 0. Log clair des sources ignorées.
- [ ] **T3 — Bandeau d'accueil.** Trois chiffres liés (projets, icônes, podcasts) +
      « mis à jour le ». Composant serveur, aucun JS.
- [ ] **T4 — Nouveautés.** Afficher les 3 dernières entrées de `changelog.entries`
      avec un lien vers `/changelog/` ; ne pas dupliquer le flux RSS.
- [ ] **T5 — CI nocturne.** `pnpm sync:ecosystem` avant le build, non bloquant, sans
      commit obligatoire (le build utilise le fichier généré localement).
- [ ] **T6 — Vérification.** `pnpm check` + build ; s'assurer que l'absence de réseau
      local ne casse pas `pnpm dev`.

**Critères d'acceptation**

- Les chiffres correspondent aux catalogues au moment du déploiement nocturne.
- Aucun appel réseau depuis le navigateur.
- Le site reste vert si un catalogue est indisponible.

---

### 4.5 Quick win — FR complet

**Objectif** : 58 fiches sur 58 en français, et un chemin de contribution pour les
traductions futures.

**Constat chiffré (2026-11-06)** : 13 fiches ont une `descriptionFr`, 45 n'en ont pas.
Les trois coups de cœur sont traduits, mais des fiches très visibles comme
`yoto-card-studio`, `yoto-app`, `custom-yoto-cards`, `yoto-cli` ou `yoto-manager` ne
le sont pas. L'interface et les routes sont déjà à parité ; seul le contenu des fiches
est incomplet.

**Pourquoi c'est un quick win** : 45 descriptions de 20–180 caractères représentent
environ 5 000 caractères, soit quelques heures de rédaction. Cela améliore
immédiatement la recherche FR (Pagefind indexe le texte rendu), le SEO francophone et
la crédibilité du portail bilingue. C'est aussi le moment de le faire : les fiches
seront retouchées en vague 2 (guides, alternatives), autant ne pas traduire deux fois.

**Fichiers**

- Créer : `scripts/check-translations.ts`, `tests/translations.test.ts`,
  `docs/translation-glossary.md`, `.github/ISSUE_TEMPLATE/translate-project.yml`,
  `site/src/lib/edit-links.ts`, `site/src/lib/edit-links.test.ts`.
- Modifier : les 45 fichiers `data/projects/*.yml` concernés,
  `site/src/views/ProjectView.astro`, `site/src/views/ContributeView.astro`,
  `site/src/i18n/en.ts`, `site/src/i18n/fr.ts`, `package.json`,
  `.github/workflows/ci.yml`.

**Tâches**

- [ ] **T1 — Mesure automatique.** `check-translations.ts` lit `data/projects/*.yml`,
      compte les `descriptionFr` manquantes ou hors bornes (20–180), imprime la liste
      des slugs et un pourcentage. Script `pnpm check:fr`. Sort en erreur uniquement
      sous le seuil `TRANSLATION_FLOOR` (fixé à 100 % après le sprint).
- [ ] **T2 — Rédaction.** Traduire les 45 descriptions avec une règle simple : une
      phrase factuelle, orientation usage, pas de superlatif, 20–180 caractères. Les
      termes récurrents (carte MYO, lecteur, piste, icône, label, sauvegarde) sont
      fixés dans le glossaire pour éviter les variantes.
- [ ] **T3 — Glossaire.** `docs/translation-glossary.md` : terme EN, terme FR retenu,
      cas d'usage, contre-exemples. Il sert aux humains comme aux agents.
- [ ] **T4 — Chemin de contribution.** Sur une fiche non traduite, afficher deux
      liens : « Modifier sur GitHub » (édition directe du YAML via
      `https://github.com/yoto-community/yoto-community.github.io/edit/main/data/projects/<slug>.yml`)
      et « Proposer une traduction » (issue form `translate-project.yml`, slug
      pré-rempli). Le badge « EN » existant reste le déclencheur visuel.
- [ ] **T5 — Verrou anti-régression.** Une fois 100 % atteint, la CI échoue si une
      nouvelle fiche ajoutée après le 2026-12-01 n'a pas de `descriptionFr`. Les
      fiches existantes restent valides : le schéma ne change pas, la règle est dans
      `check-translations.ts`.
- [ ] **T6 — Vérification FR.** Rechercher 3 requêtes françaises dans Pagefind
      (« carte », « sauvegarde », « podcast ») et vérifier que les fiches traduites
      remontent avec leur texte FR ; vérifier `hreflang` et `check:i18n`.

**Critères d'acceptation**

- `pnpm check:fr` : 58/58, 0 description hors bornes.
- Chaque fiche non traduite propose un chemin d'édition ou de traduction.
- Le glossaire est commité et utilisé dans la revue.
- Aucune régression de la parité des routes ou des clés i18n.

**Risques**

- Traduction littérale ou marketing → glossaire + relecture humaine obligatoire.
- Contribution externe de mauvaise qualité → formulaire de traduction, revue avant merge.
- Croissance de la liste → le verrou anti-régression ne s'applique qu'aux nouvelles
  fiches, pas aux 45 existantes pendant le sprint.

**Charge** : 0,5 j de code + 3–4 h de rédaction/relecture.

---

### 4.6 Same-origin : ce qui vaut vraiment le coup

**Ce que l'origine partagée permet réellement**

| Capacité                                          | État actuel                                                                                        | Intérêt    |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------- |
| `localStorage` commun                             | Oui, mais clés disparates : `yoto-icons-favorites`, `yoto-favorites`, `yoto-icons-theme`, `locale` | ★★★★       |
| Événement `storage` entre onglets et sous-chemins | Oui, natif                                                                                         | ★★★        |
| Navigation croisée                                | Déjà un menu « Communauté »                                                                        | ★★         |
| Cookies partagés                                  | Oui, mais aucun besoin (pas d'auth)                                                                | ☆          |
| Service worker racine                             | Non, et **à éviter** (voir plus bas)                                                               | ☆          |
| Code partagé                                      | Non : quatre dépôts, quatre builds                                                                 | Contrainte |

**Ce qu'on construit : une « trousse » et un contrat de stockage**

- Contrat versionné, documenté dans `docs/shared-storage.md` :

```json
{
  "yoto-community:toolkit:v1": {
    "version": 1,
    "items": [
      { "type": "project", "id": "louis", "title": "Louis", "addedAt": "2026-11-06" },
      { "type": "icon", "id": "moon-42", "title": "Moon", "addedAt": "2026-11-06" },
      { "type": "podcast", "id": "une-histoire", "title": "Une histoire", "addedAt": "2026-11-06" }
    ]
  },
  "yoto-community:prefs:v1": {
    "version": 1,
    "theme": "system",
    "locale": "fr"
  }
}
```

- Règles :
  - Namespace `yoto-community:*`, champ `version`, tolérance aux versions inconnues.
  - Lecture des anciennes clés en **read-only** (`yoto-icons-favorites`,
    `yoto-favorites`, `yoto-icons-theme`) puis fusion dans la nouvelle clé au premier
    écrit. On ne supprime jamais les anciennes clés : pas de régression pour les
    utilisateurs existants.
  - `try/catch` systématique autour de `localStorage` (mode privé Safari, stockage
    désactivé) ; l'absence de stockage ne doit jamais casser la page.
  - Synchronisation inter-onglets via l'événement `storage`.
  - Aucune donnée personnelle, aucun identifiant, rien qui sorte du navigateur.
  - Export/import JSON sur `/toolkit/`, plus une impression pour la checklist MYO.
- Portail d'abord : cœur sur les cartes et fiches, page `/toolkit/` groupée par type,
  export/import, impression. **Ne pas toucher aux sous-sites tant que la version
  portail n'a pas prouvé son usage.**
- Ensuite seulement, PR séparées : `icons-catalogue` (miroir des favoris existants
  vers la trousse) et `podcast-catalogue`. Chaque PR est autonome et peut être
  refusée sans casser le portail.

**Ce qu'on ne fait pas**

- **Service worker à la racine** : un SW déployé à `/sw.js` avec `scope: /` prendrait
  le contrôle de `/icons-catalogue/` et `/podcast-catalogue/`, qui ont leurs propres
  SW et leurs propres stratégies de cache. Le risque de panne silencieuse et de cache
  incohérent est élevé. Chaque site garde son SW dans son sous-chemin.
- **Cookies ou compte unifié** : aucun besoin, contraire à la promesse « aucun compte ».
- **Package partagé** `@yoto-community/shared-storage` : inutile tant que le contrat
  fait 30 lignes. Dupliquer le petit module + le document de contrat suffit ; on
  factorisera si un troisième consommateur apparaît.
- **Synchronisation serveur** : hors contrainte statique.
- **Redirection automatique de langue** : le portail route par URL (`/fr/`), pas par
  préférence stockée. Une redirection casserait le SEO et les liens partagés. On peut
  au maximum pré-sélectionner le lien de langue, pas rediriger.

**Fichiers (portail)**

- Créer : `docs/shared-storage.md`, `site/src/lib/toolkit.ts`,
  `site/src/lib/toolkit.test.ts`, `site/src/components/ToolkitButton.astro`,
  `site/src/views/ToolkitView.astro`, `site/src/pages/toolkit.astro`,
  `site/src/pages/fr/toolkit.astro`, `site/src/scripts/toolkit.ts`.
- Modifier : `site/src/components/ProjectCard.astro`,
  `site/src/views/ProjectView.astro`, `site/src/i18n/en.ts`, `site/src/i18n/fr.ts`,
  `site/src/components/Header.astro`, `site/src/components/FilterBar.astro`.

**Critères d'acceptation**

- Ajouter/retirer un projet met à jour la trousse sans rechargement et sans erreur si
  `localStorage` est indisponible.
- La trousse survit à un rechargement, se synchronise entre deux onglets, s'exporte et
  s'importe.
- Les favoris d'icônes existants ne sont ni perdus ni modifiés tant que la PR
  `icons-catalogue` n'est pas fusionnée.
- Aucune requête réseau, aucun cookie, aucune donnée personnelle.
- `check:budget` reste vert (le script client vise < 4 Ko gzip).

**Risques**

- Fonctionnalité peu utilisée → la lancer portail-only, mesurer les retours, ne pas
  investir dans les sous-sites avant.
- Stockage vidé par le navigateur → export/import comme filet de sécurité.
- Dérive des clés entre dépôts → un seul document de contrat, lu par chaque PR.
- Collision avec le futur PWA → le SW du portail, s'il existe un jour, doit rester
  limité à `/` et être testé avec les sous-sites.

**Charge** : 3–4 j pour le portail, 1–2 j par sous-site, 0,5 j pour les préférences.

**Recommandation honnête** : la trousse est un pari, pas une évidence. Elle devient
vraiment utile quand les guides recommandent des outils (« garde ce podcast, cette
icône et cet outil dans ta trousse »). On peut donc la repousser après les guides, et
ne livrer maintenant que le **contrat de stockage** (document + constantes), pour que
les sous-sites n'aient pas à se contredire plus tard.

---

## 5. Vague 2 — esquisse

### 5.1 Recherche unifiée (handoff)

- Garder Pagefind pour le portail. Ajouter sous les résultats un bloc « Chercher dans
  les catalogues » avec 2–3 liens construits à partir de la requête :
  - `https://yoto-community.github.io/icons-catalogue/?q=<query>`
  - `https://yoto-community.github.io/podcast-catalogue/?q=<query>`
  - `https://yoto-community.github.io/podcast-catalogue/fr/?q=<query>` si `lang=fr`
  - `playlist-catalogue` quand il sera déployé.
- Écouter l'input Pagefind (`#search input`) pour mettre à jour les `href` en direct.
- Ne **pas** fusionner les index Pagefind : `mergeIndex` exigerait un ordre de build
  inter-dépôts et l'index icônes pèse 35 Mo. Le handoff donne 90 % du bénéfice pour
  5 % du risque.
- Fichiers : `site/src/lib/search-handoff.ts`, `site/src/components/Search.astro`,
  tests unitaires + e2e.

### 5.2 Guides par usage

Trois guides, chacun avec un parcours complet et une checklist imprimable :

1. **YouTube → carte Yoto** : playlist → MP3 → découpage → icône → carte.
2. **Livre audio → carte Yoto** : dossier → chapitres → métadonnées → carte.
3. **Sauvegarder ses cartes** : export, stockage, restauration, avertissement légal.

Chaque guide réutilise les fiches du catalogue, le chooser et l'étape MYO
correspondante. Données dans `data/guides/<slug>.yml`, validées par
`schema/guide.schema.json`, générées dans `site/src/generated/guides.json`, rendues par
`GuideView.astro` sur `/guides/<slug>/` et `/fr/guides/<slug>/`.

### 5.3 Pages tags et alternatives

- `/tags/<tag>/` : liste filtrée + description éditoriale courte + JSON-LD `ItemList`.
- `/alternatives/<slug>/` : « Alternatives à X », tableau comparatif généré
  (plateformes, statut, licence, prérequis, étoiles) à partir des projets de la même
  catégorie et des tags communs. Aucun nouveau contenu obligatoire.
- Attention à la cannibalisation SEO : canonical vers la fiche projet pour les pages
  trop proches, et `noindex` si moins de 2 alternatives.

### 5.4 Trousse partagée (localStorage, même origine)

- Clé commune : `yoto-community:toolkit:v1`, valeur
  `{ version: 1, items: [{ type, id, title, addedAt }] }`.
- Bouton cœur sur les cartes et fiches ; page `/toolkit/` groupée par type, export
  JSON, import JSON, impression.
- Côté `icons-catalogue` : miroir optionnel des favoris existants
  (`yoto-icons-favorites`) vers la trousse, dans une PR séparée. Ne pas renommer la clé
  existante pour ne pas casser les favoris en place.
- Contraintes : `localStorage` indisponible en SSR → initialisation côté client
  uniquement, synchronisation `storage` entre onglets, quota (ids seulement).
- Démarrage portail-only ; l'intégration icônes est un bonus, pas un prérequis.

---

## 6. Vague 3 — esquisse

- **`llms.txt` + `llms-full.txt`** générés au build : nom, description, catégories,
  liens vers l'API et les guides. Coût quasi nul, utile aux assistants IA.
- **API versionnée** : publier `schemaVersion`, une politique de compatibilité, les
  schémas JSON (`/schema/project.schema.json`), et un exemple `curl`. Ajouter
  `ETag`/`Last-Modified` naturellement fournis par Pages.
- **Badge « Listed on Awesome Yoto »** : SVG statique par projet ou badge générique,
  avec lien vers la fiche. Optionnel.
- **Digest** : section « nouveaux ce mois-ci » déjà alimentée par le changelog ;
  réutiliser `feed.xml`/`feed.json` plutôt que créer une newsletter.
- **PWA légère** : manifest + service worker ne mettant en cache que le guide MYO et
  les pages de référence ; pas de cache agressif des fiches.
- **Palette ⌘K** : navigation + recherche, sans dupliquer Pagefind.
- **FR complet** : traduire les 58 descriptions manquantes et les guides.

---

## 7. Séquencement et charge

| Vague | Contenu                                         | Charge estimée | Dépendances                                                         |
| ----- | ----------------------------------------------- | -------------- | ------------------------------------------------------------------- |
| 0     | FR complet, contrat same-origin, lien d'édition | 1–2 j          | Aucune                                                              |
| 1     | Chooser, santé, corrections, stats              | 8–10 j         | Aucune, parallélisable avec la vague 0                              |
| 2     | Recherche unifiée, guides, tags, trousse        | 12–16 j        | Vague 1 ; guides avant la trousse ; PR inter-dépôts pour la trousse |
| 3     | llms.txt, API, digest, PWA, guides FR           | 8–12 j         | Vague 2                                                             |

Ordre interne de la vague 1 : **4.2 (santé)** et **4.3 (corrections)** d'abord, car
ils sont courts et touchent les composants partagés ; puis **4.1 (chooser)**, la plus
grosse pièce ; puis **4.4 (stats)**, purement additive.

---

## 8. Métriques de succès

Sans analytics, on mesure ce qui est observable :

- **Search Console** : impressions et clics sur `/chooser/`, `/guides/*`,
  `/tags/*`, `/alternatives/*` ; requêtes du type « converti youtube carte yoto ».
- **GitHub** : nombre de PR externes fusionnées par mois ; nombre d'issues
  `update-request` traitées ; étoiles du dépôt.
- **Qualité** : liens morts ouverts (objectif : 0 en fin de chaque semaine) ; % de
  projets `active`/`maintained` ; temps médian depuis le dernier commit.
- **Produit** : 5 tests utilisateurs sur le chooser (un parent doit obtenir une
  recommandation jugeable correcte en moins d'une minute).
- **Technique** : budget JS < 30 Ko maintenu ; Lighthouse ≥ 95 ; axe sans erreur
  critique.

---

## 9. Décisions à prendre

1. **Valider la vague 1** telle quelle, ou réduire à 2 features (santé + chooser) pour
   livrer plus vite.
2. **Vague 0** : confirme-t-on le sprint FR + le lien « Modifier sur GitHub » avant la
   vague 1 ? C'est la dette la plus visible et la moins chère.
3. **Trousse partagée** : accepte-t-on une PR dans `icons-catalogue` pour mirroir les
   favoris ? Si non, la feature reste portail-only et perd la moitié de sa valeur. On
   peut aussi ne livrer que le contrat maintenant et reporter la trousse après les
   guides.
4. **Guides** : rédaction déléguée à un agent ou écrite par toi ? Le plan peut générer
   la structure, mais la relecture éditoriale doit rester humaine.
5. **Playlist catalogue** : quand sera-t-il déployé ? Cela conditionne le bandeau de
   stats et le troisième lien de recherche unifiée.
6. **Analytics** : confirmation qu'on reste à zéro. Si oui, les métriques ci-dessus
   sont le maximum mesurable.
