// ─────────────────────────────────────────────────────────────────────────────
// Prisma Client Singleton
// ─────────────────────────────────────────────────────────────────────────────
const { PrismaClient } = require('@prisma/client');

let prisma = null;

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
    });
  }
  return prisma;
}

async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

module.exports = { getPrisma, disconnectPrisma };
