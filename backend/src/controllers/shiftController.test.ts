import { Response } from 'express';
import { prismaMock, resetPrismaMock } from '../test/prismaMock';

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: prismaMock,
}));

import { getAllShifts } from './shiftController';
import { AuthenticatedRequest } from '../middleware/auth';

beforeEach(() => {
  resetPrismaMock();
});

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('getAllShifts pagination', () => {
  it('defaults to page 1 with a limit of 20', async () => {
    prismaMock.shift.findMany.mockResolvedValue([]);
    prismaMock.shift.count.mockResolvedValue(0);

    const req = { query: {} } as unknown as AuthenticatedRequest;
    const res = mockRes();

    await getAllShifts(req, res);

    expect(prismaMock.shift.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
    expect(res.json).toHaveBeenCalledWith({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('applies the requested page and limit', async () => {
    prismaMock.shift.findMany.mockResolvedValue([]);
    prismaMock.shift.count.mockResolvedValue(45);

    const req = { query: { page: '3', limit: '10' } } as unknown as AuthenticatedRequest;
    const res = mockRes();

    await getAllShifts(req, res);

    expect(prismaMock.shift.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ pagination: { page: 3, limit: 10, total: 45, totalPages: 5 } }),
    );
  });

  it('caps the limit at 100 to prevent unbounded queries', async () => {
    prismaMock.shift.findMany.mockResolvedValue([]);
    prismaMock.shift.count.mockResolvedValue(0);

    const req = { query: { limit: '5000' } } as unknown as AuthenticatedRequest;
    const res = mockRes();

    await getAllShifts(req, res);

    expect(prismaMock.shift.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it('falls back to page 1 for invalid/negative page values', async () => {
    prismaMock.shift.findMany.mockResolvedValue([]);
    prismaMock.shift.count.mockResolvedValue(0);

    const req = { query: { page: '-5' } } as unknown as AuthenticatedRequest;
    const res = mockRes();

    await getAllShifts(req, res);

    expect(prismaMock.shift.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 }),
    );
  });
});
