import { Request, Response } from 'express';
import { prismaMock, resetPrismaMock } from '../test/prismaMock';

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('signed-token'),
}));

import bcrypt from 'bcrypt';
import { register, login } from './authController';

beforeEach(() => {
  resetPrismaMock();
  process.env.JWT_SECRET = 'test-secret';
});

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('register', () => {
  it('rejects when required fields are missing', async () => {
    const req = { body: { email: 'a@b.com' } } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid role', async () => {
    const req = {
      body: { name: 'A', email: 'a@b.com', password: 'pw', role: 'superadmin' },
    } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('role') }),
    );
  });

  it('rejects when the email is already registered', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'existing' } as any);
    const req = {
      body: { name: 'A', email: 'a@b.com', password: 'pw', role: 'volunteer' },
    } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('creates the user and returns a token on success', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: 'user-1',
      name: 'A',
      email: 'a@b.com',
      role: 'volunteer',
    } as any);

    const req = {
      body: { name: 'A', email: 'a@b.com', password: 'pw', role: 'volunteer' },
    } as Request;
    const res = mockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'signed-token', user: expect.objectContaining({ id: 'user-1' }) }),
    );
  });
});

describe('login', () => {
  it('rejects when credentials are missing', async () => {
    const req = { body: { email: 'a@b.com' } } as Request;
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects an unknown email with a generic message', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const req = { body: { email: 'a@b.com', password: 'pw' } } as Request;
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid credentials' });
  });

  it('rejects a wrong password with the same generic message', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', password_hash: 'hashed' } as any);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const req = { body: { email: 'a@b.com', password: 'wrong' } } as Request;
    const res = mockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid credentials' });
  });

  it('returns a token on valid credentials', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'A',
      email: 'a@b.com',
      role: 'volunteer',
      password_hash: 'hashed',
    } as any);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const req = { body: { email: 'a@b.com', password: 'correct' } } as Request;
    const res = mockRes();

    await login(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'signed-token' }),
    );
  });
});
