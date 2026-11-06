# Contrat de stockage partagé (`yoto-community:*`)

- **Version** : 1
- **Date** : 2026-11-06
- **Portée** : `yoto-community.github.io`, `icons-catalogue`,
  `podcast-catalogue`, `playlist-catalogue`
- **Implémentations de référence** :
  - `yoto-community.github.io/site/src/lib/toolkit.ts`
  - `yoto-community.github.io/site/src/lib/prefs.ts`
  - `icons-catalogue/site/src/lib/sharedStorage.ts`
  - `podcast-catalogue/site/src/lib/shared-storage.ts`

Les sites sont servis depuis la même origine. Ils partagent donc le même
`localStorage`, sans cookie, sans compte et sans requête réseau. Ce document est
le contrat commun : chaque site peut le lire et l’implémenter indépendamment,
sans package partagé.

## 1. Clés

| Clé                         | Statut | Contenu                                        |
| --------------------------- | ------ | ---------------------------------------------- |
| `yoto-community:toolkit:v1` | Actif  | Trousse : projets, icônes et podcasts          |
| `yoto-community:prefs:v1`   | Actif  | Préférences : thème et langue                  |
| `yoto-icons-favorites`      | Hérité | Anciens favoris d’icônes (tableau d’ids)       |
| `yoto-icons-theme`          | Hérité | Ancien thème du catalogue d’icônes             |
| `yoto-favorites`            | Hérité | Anciens favoris de podcasts (tableau de slugs) |
| `yoto-locale`               | Hérité | Ancienne langue du catalogue de podcasts       |
| `locale`                    | Hérité | Ancienne langue du catalogue d’icônes          |

Le préfixe `yoto-community:*` est réservé au contrat partagé. Les clés héritées
ne doivent **jamais** être supprimées par les autres sites.

## 2. Trousse — format v1

```json
{
  "version": 1,
  "items": [
    {
      "type": "project",
      "id": "louis",
      "title": "Louis",
      "addedAt": "2026-11-06"
    },
    {
      "type": "icon",
      "id": "LZ0OGDaJz-Mbud5o3yDBBjeFvDHVdkSNTXIWogHZ0kw",
      "title": "Bluey",
      "addedAt": "2026-11-06"
    },
    {
      "type": "podcast",
      "id": "une-histoire",
      "title": "Une histoire",
      "addedAt": "2026-11-06"
    }
  ]
}
```

### Champs

- `version` : entier, actuellement `1`. Un lecteur v1 qui rencontre une autre
  version ignore la valeur au lieu d’inventer sa forme.
- `items` : tableau. L’ordre est l’ordre d’ajout, du plus ancien au plus récent.
- `type` : `project`, `icon` ou `podcast`. Les valeurs inconnues sont ignorées.
- `id` : identifiant stable dans le site source.
  - `project` : le slug de la fiche (`louis`, `yoto-card-studio`).
  - `icon` : l’identifiant du catalogue d’icônes.
  - `podcast` : le slug du podcast dans le catalogue.
- `title` : libellé lisible au moment de l’ajout. Il évite d’avoir à joindre le
  site source pour afficher la trousse. Si le titre manque, le lecteur retombe
  sur `id`.
- `addedAt` : date ISO `YYYY-MM-DD`. Si elle manque, le lecteur utilise la date
  du jour.

Un item est identifié par le couple `type:id` : deux types différents peuvent
partager le même `id`. Les doublons `type:id` sont ignorés (le premier gagne).

### Qui écrit quoi

- Le **portail** ajoute et retire les items `project`.
- Le **catalogue d’icônes** remplace la slice `icon` à chaque changement de ses
  favoris. Il conserve les items `project` et `podcast`.
- Le **catalogue de podcasts** remplace la slice `podcast` à chaque changement
  de ses favoris. Il conserve les items `project` et `icon`.
- Chaque site écrit la trousse entière, avec `version: 1`.

### Sens de vérité

Tant que `yoto-community:toolkit:v1` n’existe pas, les anciennes clés restent la
source. Dès qu’elle existe, la trousse est la source de vérité pour les favoris
d’icônes et de podcasts. Ainsi :

- un favori ajouté dans `icons-catalogue` apparaît immédiatement dans la trousse
  du portail, avec son vrai titre ;
- un retrait fait depuis le portail est répercuté dans `icons-catalogue` lors du
  prochain chargement ou de l’événement `storage` ;
- les anciennes clés restent intactes pour les utilisateurs qui n’ont pas encore
  migré.

## 3. Préférences — format v1

```json
{
  "version": 1,
  "theme": "dark",
  "locale": "fr"
}
```

- `theme` : `light`, `dark` ou `system`.
- `locale` : `fr` ou `en`.
- Les deux champs sont optionnels : une écriture partielle conserve l’autre
  champ.
- Lecture : la clé partagée d’abord, puis les anciennes clés
  (`yoto-icons-theme`, `yoto-locale`, `locale`) pour migrer les choix existants.
- Écriture : les sites continuent d’écrire leur ancienne clé en plus de la clé
  partagée, afin de ne pas casser les comportements historiques.

### Comportement par site

- **Catalogue d’icônes** : le sélecteur de langue et de thème écrit la préférence
  partagée. Le script inline du `<head>` applique le thème avant le premier
  rendu.
- **Catalogue de podcasts** : les sélecteurs de langue et de thème écrivent la
  préférence partagée. La racine redirige vers la langue mémorisée.
- **Portail** : le lien FR/EN écrit la langue partagée. Les pages d’accueil
  `/` et `/fr/` redirigent vers la langue mémorisée. Le thème partagé est
  appliqué avant le premier rendu via `data-theme`.

Le portail ne redirige **que** ses deux pages d’accueil : les URL profondes
restent stables pour le SEO et les liens partagés.

## 4. Règles de lecture et d’écriture

1. **Aucun accès au stockage au chargement d’un module SSR.** Le code partagé
   expose des fonctions ; les accès se font côté navigateur.
2. **Tout accès est protégé par `try/catch`.** Mode privé Safari, stockage
   désactivé, quota dépassé : la page continue de fonctionner.
3. **Écriture atomique par clé.** Chaque site écrit la valeur complète de
   `yoto-community:toolkit:v1` ou de `yoto-community:prefs:v1`.
4. **Synchronisation inter-onglets.** Écouter `storage` sur les clés partagées.
   Pour la même page, émettre `yoto-community:toolkit-change` après écriture.
5. **Aucune donnée personnelle.** Pas de nom, pas d’e-mail, pas d’identifiant de
   compte, rien qui sorte du navigateur.
6. **Export / import.** L’export produit exactement l’objet v1 ci-dessus en JSON.
   L’import valide `version` et `items`, ignore les entrées invalides, puis
   fusionne par `type:id` sans écraser un item existant.

## 5. Migration et intégration d’un nouveau site

1. Lire `yoto-community:toolkit:v1` en priorité.
2. Si elle n’existe pas, lire les anciennes clés en **lecture seule** et créer
   les items correspondants avec le vrai titre quand le site le connaît.
3. Remplacer uniquement sa propre slice (`project`, `icon` ou `podcast`) et
   conserver les autres.
4. Conserver les anciennes clés, même après migration.
5. Écouter `storage` pour les changements venus des autres sous-chemins.

## 6. Ce que le contrat n’autorise pas

- Un cookie ou un identifiant de visiteur.
- Un service worker à la racine `/` qui prendrait le contrôle des sous-sites.
- Une synchronisation serveur ou un compte.
- Une redirection automatique de langue sur les URL profondes.
- La suppression des clés héritées.
