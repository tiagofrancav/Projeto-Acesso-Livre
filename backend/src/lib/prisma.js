import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Prisma 7 exige um adapter ou Accelerate; usamos o driver pg oficial.
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

