import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Modify DATABASE_URL to disable prepared statements
function getModifiedDatabaseUrl() {
  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) return baseUrl

  const url = new URL(baseUrl)
  url.searchParams.set('prepared_statements', 'false')
  url.searchParams.set('statement_cache_size', '0')
  url.searchParams.set('connection_limit', '1')
  return url.toString()
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
    datasources: {
      db: {
        url: getModifiedDatabaseUrl(),
      },
    }
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma