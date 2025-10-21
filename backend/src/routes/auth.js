import express from 'express';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body || {};
    if (!email || !senha) return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' });
    const ok = await bcrypt.compare(senha, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas.' });
    const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, surname: user.surname } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro ao efetuar login.' });
  }
});

export default router;

