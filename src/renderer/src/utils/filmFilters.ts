export interface FilmFilter {
  id: string
  name: string
  cssFilter: string
  overlayStyle?: React.CSSProperties
}

export const FILM_FILTERS: Record<string, FilmFilter> = {
  none: { id: 'none', name: 'None', cssFilter: 'none' },
  kodachrome64: {
    id: 'kodachrome64', name: "Kodachrome '64",
    cssFilter: 'contrast(1.08) saturate(1.15) sepia(0.12) hue-rotate(-5deg)'
  },
  velvia50: {
    id: 'velvia50', name: 'Velvia 50',
    cssFilter: 'contrast(1.2) saturate(1.4)'
  },
  trix400: {
    id: 'trix400', name: 'Tri-X 400',
    cssFilter: 'grayscale(1) contrast(1.15)'
  },
  cyanotype: {
    id: 'cyanotype', name: 'Cyanotype',
    cssFilter: 'grayscale(1) sepia(0.4) hue-rotate(180deg) saturate(1.3)'
  },
  platinum: {
    id: 'platinum', name: 'Platinum',
    cssFilter: 'grayscale(1) brightness(1.05) contrast(0.9) sepia(0.15)'
  },
  halation: {
    id: 'halation', name: 'Halation',
    cssFilter: 'none'
  },
  '8mm': {
    id: '8mm', name: '8mm Reel',
    cssFilter: 'contrast(1.1) saturate(0.8) sepia(0.2)'
  },
  chamber: {
    id: 'chamber', name: 'Chamber',
    cssFilter: 'brightness(0.85) contrast(1.1)'
  }
}

export function getFilterStyle(filterId: string, grain: number, halation: number, vignette: number): React.CSSProperties {
  const f = FILM_FILTERS[filterId] || FILM_FILTERS.none
  return { filter: f.cssFilter }
}
