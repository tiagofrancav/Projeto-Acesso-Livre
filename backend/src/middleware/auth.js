import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { getJwtSecret } from '../lib/config.js';

const JWT_SECRET = getJwtSecret();

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Token de autenticação ausente.' });
    }
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = typeof payload.sub === 'string' ? parseInt(payload.sub, 10) : payload.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Token inválido.' });
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error('[auth] erro na verificação do token', err);
    res.status(401).json({ error: 'Autenticação necessária.' });
  }
}

export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return next();
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = typeof payload.sub === 'string' ? parseInt(payload.sub, 10) : payload.sub;
    if (!Number.isFinite(userId)) {
      return next();
    }
    const user = await prisma.user.findUnique({ where: { id: userId } }).catch((err) => {
      console.error('[auth] erro no optionalAuth', err);
      return null;
    });
    if (user) {
      req.user = user;
    }
  } catch (err) {
    console.error('[auth] token inválido', err);
  } finally {
    next();
  }
}
