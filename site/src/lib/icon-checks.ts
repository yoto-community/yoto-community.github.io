import {
  COLOR_COUNT_WARN,
  countColors,
  hasPureBlack,
  isEmpty,
  type PixelGrid,
} from '@yoto-community/pixel-editor-core';

/** Résultat des contrôles Yoto appliqués à une icône candidate. */
export interface IconReview {
  /** Aucun pixel visible : l'icône ne montrerait rien sur le lecteur. */
  empty: boolean;
  /** Noir pur : invisible sur le fond noir de l'écran du lecteur. */
  pureBlack: boolean;
  /** Nombre de couleurs RGBA distinctes parmi les pixels visibles. */
  colors: number;
  /** Dépasse le seuil de sobriété recommandé pour une icône 16×16. */
  tooManyColors: boolean;
}

/**
 * Résume les règles éditoriales de l'étape « Choisir l'icône » du parcours MYO
 * (fond du lecteur sombre, lisibilité en petit) en un objet testable.
 *
 * Purement fonctionnel : aucun accès au DOM, aucun texte — la traduction est
 * laissée à l'appelant, qui décide comment afficher chaque signal.
 */
export function reviewIcon(grid: PixelGrid, maxColors: number = COLOR_COUNT_WARN): IconReview {
  const colors = countColors(grid);
  return {
    empty: isEmpty(grid),
    pureBlack: hasPureBlack(grid),
    colors,
    tooManyColors: colors > maxColors,
  };
}
