import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { Role } from '@prisma/client';

const SALT_ROUNDS = 10;

const signToken = (id: string, role: Role): string => {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
  };
  return jwt.sign({ id, role }, process.env.JWT_SECRET as string, options) as string;
};

export const register = async (req: Request, res: Response) => {
  const { name, email, password, role, skills, availability_json } = req.body;

  if (!name || !email || !password || !role) {
    res.status(400).json({ message: 'name, email, password, and role are required' });
    return;
  }

  if (!Object.values(Role).includes(role)) {
    res.status(400).json({ message: 'role must be volunteer or org_admin' });
    return;
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ message: 'Email already in use' });
      return;
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        role,
        skills: role === 'volunteer' ? (skills ?? []) : [],
        availability_json: role === 'volunteer' ? (availability_json ?? null) : null,
      },
    });

    const token = signToken(user.id, user.role);

    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: 'Registration failed', error: err });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: 'email and password are required' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const token = signToken(user.id, user.role);

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err });
  }
};
