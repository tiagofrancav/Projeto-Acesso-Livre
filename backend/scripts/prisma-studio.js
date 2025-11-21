import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Carrega o .env do backend
loadEnv({ path: path.resolve(projectRoot, '.env') });

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('DATABASE_URL não definido. Ajuste backend/.env ou exporte a variável antes de rodar.');
  process.exit(1);
}

const result = spawnSync(
  'npx',
  ['prisma', 'studio', '--config', 'prisma.config.js', '--url', url],
  {
    stdio: 'inherit',
    shell: true,
    cwd: projectRoot,
  },
);

process.exit(result.status ?? 1);
