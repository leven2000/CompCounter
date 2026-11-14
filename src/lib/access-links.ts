import QRCode from 'qrcode'

export type AccessLink = {
  id: string
  title: string
  hint: string
  url: string
  code?: string
  qr?: string
}

export function qrSvg(url: string) {
  return QRCode.toString(url, { type: 'svg', margin: 0 })
}

export function mesaLink(origin: string, code: string): AccessLink {
  return {
    id: 'mesa',
    title: 'Mesa del torneo',
    hint: 'Control de peleas, llaves, competidores y pantallas.',
    url: `${origin}/mesa/${code}`,
    code,
  }
}

export function tvLink(origin: string, areaId: string, areaName: string): AccessLink {
  return {
    id: `tv-${areaId}`,
    title: `TV de ${areaName}`,
    hint: 'Tablero de la pelea en curso.',
    url: `${origin}/tv/${areaId}`,
  }
}

export function boardLink(origin: string, slug: string): AccessLink {
  return {
    id: 'cartelera',
    title: 'Cartelera',
    hint: 'Horarios, área y orden de las peleas, para los competidores.',
    url: `${origin}/cartelera/${slug}`,
  }
}

export function overviewLink(origin: string, slug: string): AccessLink {
  return {
    id: 'general',
    title: 'TV general',
    hint: 'Todas las áreas con su pelea en curso.',
    url: `${origin}/tv/torneo/${slug}`,
  }
}
