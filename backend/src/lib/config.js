import process from 'node:process';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Environment variable JWT_SECRET must be set.');
  }
  return secret;
}

export function getAppName() {
  return process.env.APP_NAME || 'Livre Acesso';
}
