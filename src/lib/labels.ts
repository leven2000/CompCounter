export const EVENT_LABEL: Record<string, string> = {
  POINT: 'Puntos',
  ADV: 'Ventaja',
  PEN: 'Penalización',
  WARN: 'Advertencia',
  MINUS: 'Punto negativo',
  KD: 'Knockdown',
  EXIT: 'Salida',
  DECISION: 'Decisión de juez',
}

export const MINUS_MODE_OPTIONS: [string, string][] = [
  ['', 'Según modalidad'],
  ['SUBTRACT', 'Resta al sancionado'],
  ['RIVAL', 'Suma al rival'],
]
