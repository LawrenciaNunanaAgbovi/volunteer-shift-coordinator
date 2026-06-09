import { Server, Socket } from 'socket.io';
import prisma from '../lib/prisma';

export const registerShiftSocketHandlers = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    // Client sends { shiftId } to subscribe to live headcount for that shift
    socket.on('shift:join', async ({ shiftId }: { shiftId: string }) => {
      if (!shiftId || typeof shiftId !== 'string') return;
      socket.join(`shift:${shiftId}`);

      // Send current headcount immediately on join
      const headcount = await getCurrentHeadcount(shiftId);
      socket.emit('shift:headcount', headcount);
    });

    socket.on('shift:leave', ({ shiftId }: { shiftId: string }) => {
      socket.leave(`shift:${shiftId}`);
    });
  });
};

export const emitHeadcount = async (io: Server, shiftId: string) => {
  const headcount = await getCurrentHeadcount(shiftId);
  io.to(`shift:${shiftId}`).emit('shift:headcount', headcount);
};

const getCurrentHeadcount = async (shiftId: string) => {
  const [shift, approved, pending, waitlisted] = await Promise.all([
    prisma.shift.findUnique({ where: { id: shiftId }, select: { capacity: true } }),
    prisma.reservation.count({ where: { shift_id: shiftId, status: 'approved' } }),
    prisma.reservation.count({ where: { shift_id: shiftId, status: 'pending' } }),
    prisma.reservation.count({ where: { shift_id: shiftId, status: 'waitlisted' } }),
  ]);

  return {
    shiftId,
    capacity: shift?.capacity ?? 0,
    approved,
    pending,
    waitlisted,
    spotsLeft: Math.max(0, (shift?.capacity ?? 0) - approved - pending),
  };
};
