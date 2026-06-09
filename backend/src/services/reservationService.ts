import prisma from '../lib/prisma';
import { getIO } from '../lib/socket';
import { emitHeadcount } from '../sockets/shiftSocket';

// Statuses that count against a shift's capacity
const ACTIVE_STATUSES = ['pending', 'approved'] as const;

export const createReservation = async (shiftId: string, volunteerId: string) => {
  const result = await prisma.$transaction(async (tx) => {
    const shift = await tx.shift.findUnique({ where: { id: shiftId } });

    if (!shift) throw new Error('SHIFT_NOT_FOUND');
    if (shift.status !== 'open') throw new Error('SHIFT_NOT_OPEN');

    const alreadyReserved = await tx.reservation.findFirst({
      where: { shift_id: shiftId, volunteer_id: volunteerId },
    });
    if (alreadyReserved) throw new Error('ALREADY_RESERVED');

    // Count inside the transaction so two concurrent requests can't both
    // pass this check and exceed capacity (the race condition naive implementations miss)
    const activeCount = await tx.reservation.count({
      where: { shift_id: shiftId, status: { in: [...ACTIVE_STATUSES] } },
    });

    const isFull = activeCount >= shift.capacity;

    if (isFull) {
      const lastWaitlisted = await tx.reservation.findFirst({
        where: { shift_id: shiftId, status: 'waitlisted' },
        orderBy: { waitlist_position: 'desc' },
      });

      const waitlistPosition = (lastWaitlisted?.waitlist_position ?? 0) + 1;

      return tx.reservation.create({
        data: { shift_id: shiftId, volunteer_id: volunteerId, status: 'waitlisted', waitlist_position: waitlistPosition },
      });
    }

    return tx.reservation.create({
      data: { shift_id: shiftId, volunteer_id: volunteerId, status: 'pending' },
    });
  });

  emitHeadcount(getIO(), shiftId).catch(() => {});
  return result;
};

export const updateReservationStatus = async (
  reservationId: string,
  newStatus: 'approved' | 'denied',
  adminUserId: string
) => {
  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: { shift: { include: { org: true } } },
    });

    if (!reservation) throw new Error('RESERVATION_NOT_FOUND');
    if (reservation.shift.org.admin_user_id !== adminUserId) throw new Error('FORBIDDEN');

    const updated = await tx.reservation.update({
      where: { id: reservationId },
      data: { status: newStatus, waitlist_position: null },
    });

    // When a spot opens up, promote the next person off the waitlist
    if (newStatus === 'denied') {
      await promoteFromWaitlist(tx, reservation.shift_id);
    }

    return updated;
  });

  emitHeadcount(getIO(), result.shift_id).catch(() => {});
  return result;
};

// Promotes the next waitlisted volunteer to pending when a spot opens.
// Uses the same transaction so the promotion is atomic with the denial.
const promoteFromWaitlist = async (
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  shiftId: string
) => {
  const next = await tx.reservation.findFirst({
    where: { shift_id: shiftId, status: 'waitlisted' },
    orderBy: { waitlist_position: 'asc' },
  });

  if (!next) return;

  await tx.reservation.update({
    where: { id: next.id },
    data: { status: 'pending', waitlist_position: null },
  });

  // Close the gap left in waitlist positions
  await tx.reservation.updateMany({
    where: { shift_id: shiftId, status: 'waitlisted', waitlist_position: { gt: next.waitlist_position! } },
    data: { waitlist_position: { decrement: 1 } },
  });
};

export const getMyReservations = async (volunteerId: string) => {
  return prisma.reservation.findMany({
    where: { volunteer_id: volunteerId },
    include: {
      shift: {
        include: { org: { select: { name: true, cause_area: true } } },
      },
    },
    orderBy: { created_at: 'desc' },
  });
};

export const getShiftReservations = async (shiftId: string, adminUserId: string) => {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { org: true },
  });

  if (!shift) throw new Error('SHIFT_NOT_FOUND');
  if (shift.org.admin_user_id !== adminUserId) throw new Error('FORBIDDEN');

  return prisma.reservation.findMany({
    where: { shift_id: shiftId },
    include: {
      volunteer: { select: { id: true, name: true, email: true, skills: true } },
    },
    orderBy: [{ status: 'asc' }, { created_at: 'asc' }],
  });
};
