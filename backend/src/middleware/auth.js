import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

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
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return next();
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = typeof payload.sub === 'string' ? parseInt(payload.sub, 10) : payload.sub;
    if (!userId) {
      return next();
    }
    prisma.user.findUnique({ where: { id: userId } }).then((user) => {
      if (user) {
        req.user = user;
      }
      next();
    }).catch((err) => {
      console.error('[auth] erro no optionalAuth', err);
      next();
    });
  } catch (err) {
    console.error('[auth] token inválido', err);
    next();
  }
}
