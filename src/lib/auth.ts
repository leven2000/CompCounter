import type { Prisma } from '@prisma/client'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { db } from './db'
import { DESKTOP } from './desktop'

const COOKIE = 'session'
const WEEK = 60 * 60 * 24 * 7

function secret() {
  const value = process.env.AUTH_SECRET
  if (!value || value.length < 16 || value === 'cadena-aleatoria-larga') {
    throw new Error('Falta AUTH_SECRET (16+ caracteres, distinto del ejemplo)')
  }
  return new TextEncoder().encode(value)
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export async function startSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${WEEK}s`)
    .sign(secret())
  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && !DESKTOP,
    path: '/',
    maxAge: WEEK,
  })
}

export async function endSession() {
  const jar = await cookies()
  jar.delete(COOKIE)
}

export const currentUser = cache(async () => {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    const uid = typeof payload.uid === 'string' ? payload.uid : null
    if (!uid) return null
    const user = await db.user.findUnique({
      where: { id: uid },
      select: { id: true, email: true, name: true, role: true, active: true, orgId: true },
    })
    return user && user.active ? user : null
  } catch {
    return null
  }
})

export async function requireSuperadmin() {
  const user = await currentUser()
  if (!user) redirect('/login')
  if (user.role !== 'SUPERADMIN') redirect('/panel')
  return user
}

const ACTING = 'acting_org'

export async function setActingOrg(orgId: string | null) {
  const jar = await cookies()
  if (!orgId) {
    jar.delete(ACTING)
    return
  }
  jar.set(ACTING, orgId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && !DESKTOP,
    path: '/',
    maxAge: WEEK,
  })
}

export async function requireOrganizer() {
  const user = await currentUser()
  if (!user) redirect('/login')
  if (user.role === 'SUPERADMIN') {
    const jar = await cookies()
    const acting = jar.get(ACTING)?.value
    const org = acting
      ? await db.organization.findUnique({ where: { id: acting }, select: { id: true } })
      : null
    if (!org) redirect('/admin')
    const scope: Prisma.TournamentWhereInput = { orgId: org.id }
    return { user, orgId: org.id, acting: true, scope }
  }
  if (!user.orgId) redirect('/login')
  const scope: Prisma.TournamentWhereInput = {
    OR: [{ orgId: user.orgId }, { members: { some: { userId: user.id } } }],
  }
  return { user, orgId: user.orgId, acting: false, scope }
}
