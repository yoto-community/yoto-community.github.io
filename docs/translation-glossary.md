# Glossaire de traduction

Ce fichier fixe le vocabulaire des `descriptionFr` et des chaînes d'interface. Il
existe pour éviter les variantes : une même chose doit porter le même nom d'une
fiche à l'autre.

## Règles de style

1. **Une phrase, un fait.** La description dit ce que l'outil fait et pour qui,
   sans superlatif, sans « puissant », « révolutionnaire » ou « incontournable ».
2. **20 à 180 caractères**, point final compris. `pnpm validate` et
   `pnpm check:fr` refusent le reste.
3. **Troisième personne pour la fiche.** C'est l'outil qui agit : « Convertit une
   image… », « Outil qui enregistre… ». L'interface, elle, vouvoie le visiteur :
   « Votre trousse est vide ».
4. **Pas de traduction littérale.** « Self-hosted app that transfers… » devient
   « Application auto-hébergée qui transfère… », pas un calque de l'anglais.
5. **Les noms propres ne se traduisent pas** : Yoto, MYO, Audiobookshelf,
   Home Assistant, Spotify, Twine, Raspberry Pi, BorrowBox.
6. **Apostrophe droite** (`'`) dans les YAML, pour rester cherchable avec grep.
   L'interface Astro peut garder l'apostrophe typographique (`’`).
7. **Pas de `!`**, pas d'emoji, pas de lien Markdown : la fiche est du texte brut.
8. **16x16**, avec un `x` minuscule, comme dans les fiches existantes. Pas `×`.
9. **Pas de deux-points suivi d'une espace.** Un YAML en scalaire simple
   interprète `: ` comme une nouvelle clé et casse le fichier. Utilisez une
   virgule ou reformulez. `pnpm check:fr` signale le fichier illisible.

## Vocabulaire

| Anglais           | Français                                 | À éviter                      |
| ----------------- | ---------------------------------------- | ----------------------------- |
| card              | carte                                    | carte physique, tag           |
| MYO card          | carte MYO                                | carte perso, carte maison     |
| Make Your Own     | Make Your Own (MYO)                      | Faites-le vous-même           |
| player            | lecteur                                  | player, appareil de lecture   |
| track             | piste                                    | morceau, chanson              |
| chapter           | chapitre                                 | section                       |
| icon              | icône                                    | pictogramme                   |
| cover art         | jaquette                                 | pochette, artwork             |
| label             | étiquette                                | sticker                       |
| playlist          | playlist                                 | liste de lecture              |
| backup            | sauvegarde                               | backup, copie de sécurité     |
| firmware          | firmware                                 | micrologiciel                 |
| self-hosted       | auto-hébergé                             | self-hosted, hébergé maison   |
| browser extension | extension de navigateur                  | plugin, add-on                |
| command line      | ligne de commande                        | CLI (sauf dans un nom propre) |
| command-line tool | outil en ligne de commande               | outil CLI                     |
| to upload         | envoyer                                  | uploader, téléverser          |
| to download       | télécharger                              | downloader                    |
| API key           | clé API                                  | token, jeton d'API            |
| NFC tag / card    | puce NFC / carte NFC                     | tag NFC                       |
| library           | bibliothèque                             | librairie                     |
| family library    | bibliothèque familiale                   | bibliothèque de famille       |
| device            | lecteur (pour un Yoto), appareil (sinon) | device                        |
| share link        | lien de partage                          | lien public                   |
| desktop app       | application de bureau                    | app desktop                   |
| web app           | application web                          | webapp                        |
| single-page tool  | outil sur une seule page                 | SPA                           |
| pixel art         | pixel art                                | art pixel                     |
| to sync           | synchroniser                             | syncer                        |
| batch editor      | éditeur par lots                         | éditeur batch                 |
| teardown          | démontage                                | teardown                      |
| board map         | plan de carte                            | carte de circuit              |

## Avant de proposer une traduction

- Lire la fiche anglaise **et** la page du projet : une description qui recopie
  le nom de l'outil n'apporte rien.
- Vérifier que la phrase tient en une ligne dans la carte de la liste.
- Lancer `pnpm validate && pnpm check:fr` : les bornes de longueur sont
  contrôlées deux fois, par le schéma et par le script.

## Cas particuliers

- **Sauvegardes** : une fiche marquée `legal-backup` doit rappeler la limite dans
  sa description (« cartes que vous possédez »). C'est une règle éditoriale, pas
  seulement une traduction.
- **Projets officiels** : garder « officiel » dans la voix, sans ajouter de
  superlatif ; le badge `official` le dit déjà.
- **Projets remplacés** : la description reste au présent, et
  `deprecatedBy` porte la mention du remplaçant.
