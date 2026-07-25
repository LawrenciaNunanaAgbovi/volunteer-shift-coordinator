import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

export const prismaMock = mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>;

// Every service wraps its writes in `prisma.$transaction(cb)`; running the
// callback against the same mock lets tests assert on `tx.reservation.*`
// calls without standing up a real transaction.
prismaMock.$transaction.mockImplementation((cb: any) => cb(prismaMock));

export const resetPrismaMock = () => {
  mockReset(prismaMock);
  prismaMock.$transaction.mockImplementation((cb: any) => cb(prismaMock));
};
