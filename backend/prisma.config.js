import 'dotenv/config';
import { defineConfig, env } from '@prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    db: {
      url: env('DATABASE_URL'),
      shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});
