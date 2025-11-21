import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from '@prisma/config';

// Carrega variáveis do .env localizado na raiz do backend.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Check your .env or environment variables.');
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    db: {
      url: databaseUrl,
      shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || databaseUrl,
    },
  },
});
