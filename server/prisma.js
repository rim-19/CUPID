'use strict';

/* Shared PrismaClient singleton. A new PrismaClient opens a connection pool, so
   the app must reuse one instance. In development the module can be re-evaluated
   on hot reload, which would leak clients; caching on globalThis prevents that.
   Import `prisma` from here everywhere instead of calling `new PrismaClient()`. */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__cupidPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__cupidPrisma = prisma;
}

export default prisma;
