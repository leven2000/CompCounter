import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

try {
  const existing = await db.user.count({ where: { role: 'SUPERADMIN' } })
  if (existing > 0) {
    console.log('Administrador ya existente')
  } else {
    const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
    const password = process.env.ADMIN_PASSWORD ?? ''
    if (!email || password.length < 8) {
      console.log('Definí ADMIN_EMAIL y ADMIN_PASSWORD (8+ caracteres) para crear el administrador')
    } else {
      await db.user.create({
        data: {
          email,
          name: 'Administrador',
          role: 'SUPERADMIN',
          passwordHash: await bcrypt.hash(password, 10),
        },
      })
      console.log(`Administrador creado: ${email}`)
    }
  }
} finally {
  await db.$disconnect()
}
