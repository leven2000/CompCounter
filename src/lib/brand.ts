import type { CSSProperties } from 'react'

export type Brand = {
  orgId: string
  name: string
  logoUrl: string | null
  primary: string
  accent: string
  tvTheme: string
  c1Name: string
  c1Color: string
  c2Name: string
  c2Color: string
  showFlags: boolean
  showTeams: boolean
}

export const brandSelect = {
  id: true,
  name: true,
  logoType: true,
  colorPrimary: true,
  colorAccent: true,
  tvTheme: true,
  corner1Name: true,
  corner1Color: true,
  corner2Name: true,
  corner2Color: true,
  showFlags: true,
  showTeams: true,
  updatedAt: true,
} as const

type BrandRow = {
  id: string
  name: string
  logoType: string | null
  colorPrimary: string
  colorAccent: string
  tvTheme: string
  corner1Name: string
  corner1Color: string
  corner2Name: string
  corner2Color: string
  showFlags: boolean
  showTeams: boolean
  updatedAt: Date
}

export function toBrand(org: BrandRow): Brand {
  return {
    orgId: org.id,
    name: org.name,
    logoUrl: org.logoType ? `/api/logo/${org.id}?v=${org.updatedAt.getTime()}` : null,
    primary: org.colorPrimary,
    accent: org.colorAccent,
    tvTheme: org.tvTheme,
    c1Name: org.corner1Name,
    c1Color: org.corner1Color,
    c2Name: org.corner2Name,
    c2Color: org.corner2Color,
    showFlags: org.showFlags,
    showTeams: org.showTeams,
  }
}

export function brandStyle(brand: Brand): CSSProperties {
  return {
    '--brand': brand.primary,
    '--accent': brand.accent,
    '--c1': brand.c1Color,
    '--c2': brand.c2Color,
  } as CSSProperties
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'CompCounter'
