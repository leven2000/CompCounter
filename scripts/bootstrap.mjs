import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const EXAMPLES = new Set(['cadena-aleatoria-larga', 'vos@tudominio.com', 'una-clave-de-8-o-mas-caracteres'])

const secret = process.env.AUTH_SECRET ?? ''
if (secret.length < 16 || EXAMPLES.has(secret)) {
  console.error('AUTH_SECRET tiene que ser una cadena aleatoria de 16+ caracteres, distinta del ejemplo')
  process.exit(1)
}

const db = new PrismaClient()

try {
  const existing = await db.user.count({ where: { role: 'SUPERADMIN' } })
  if (existing > 0) {
    console.log('Administrador ya existente')
  } else {
    const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
    const password = process.env.ADMIN_PASSWORD ?? ''
    if (!email || password.length < 8 || EXAMPLES.has(email) || EXAMPLES.has(password)) {
      console.error('ADMIN_EMAIL y ADMIN_PASSWORD (8+ caracteres) tienen que ser propios, no los del ejemplo')
      process.exitCode = 1
    } else {
      await db.user.create({
        data: {
          email,
          name: 'Administrador',
          role: 'SUPERADMIN',
          passwordHash: await bcrypt.hash(password, 10),
        },
      })
      console.log('Administrador creado')
    }
  }
} finally {
  await db.$disconnect()
}
