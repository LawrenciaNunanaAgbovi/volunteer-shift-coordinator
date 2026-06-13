import prisma from '../lib/prisma';
import { getIO } from '../lib/socket';
import { emitHeadcount } from '../sockets/shiftSocket';

const ACTIVE_STATUSES = ['pending', 'approved'] as const;

export const createReservation = async (
  shiftId: string,
  volunteerId: string,
  positionId?: string | null,
) => {
  const result = await prisma.$transaction(async (tx) => {
    const shift = await tx.shift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new Error('SHIFT_NOT_FOUND');
    if (shift.status !== 'open') throw new Error('SHIFT_NOT_OPEN');

    const alreadyReserved = await tx.reservation.findFirst({
      where: { shift_id: shiftId, volunteer_id: volunteerId },
    });
    if (alreadyReserved) throw new Error('ALREADY_RESERVED');

    // If a specific position was requested, check that position's capacity
    if (positionId) {
      const position = await tx.shiftPosition.findUnique({ where: { id: positionId } });
      if (!position || position.shift_id !== shiftId) throw new Error('POSITION_NOT_FOUND');

      const positionCount = await tx.reservation.count({
        where: { position_id: positionId, status: { in: [...ACTIVE_STATUSES] } },
      });

      if (positionCount >= position.capacity) {
        // Position is full — add to shift-level waitlist (no position assigned)
        const lastWaitlisted = await tx.reservation.findFirst({
          where: { shift_id: shiftId, status: 'waitlisted' },
          orderBy: { waitlist_position: 'desc' },
        });
        return tx.reservation.create({
          data: {
            shift_id: shiftId,
            volunteer_id: volunteerId,
            status: 'waitlisted',
            waitlist_position: (lastWaitlisted?.waitlist_position ?? 0) + 1,
          },
        });
      }

      return tx.reservation.create({
        data: { shift_id: shiftId, volunteer_id: volunteerId, position_id: positionId, status: 'pending' },
      });
    }

    // No position — fall back to shift-level capacity check
    const activeCount = await tx.reservation.count({
      where: { shift_id: shiftId, status: { in: [...ACTIVE_STATUSES] } },
    });

    if (activeCount >= shift.capacity) {
      const lastWaitlisted = await tx.reservation.findFirst({
        where: { shift_id: shiftId, status: 'waitlisted' },
        orderBy: { waitlist_position: 'desc' },
      });
      return tx.reservation.create({
        data: {
          shift_id: shiftId,
          volunteer_id: volunteerId,
          status: 'waitlisted',
          waitlist_position: (lastWaitlisted?.waitlist_position ?? 0) + 1,
        },
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
  adminUserId: string,
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

    if (newStatus === 'denied') {
      await promoteFromWaitlist(tx, reservation.shift_id);
    }

    return updated;
  });

  emitHeadcount(getIO(), result.shift_id).catch(() => {});
  return result;
};

const promoteFromWaitlist = async (
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  shiftId: string,
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

  await tx.reservation.updateMany({
    where: {
      shift_id: shiftId,
      status: 'waitlisted',
      waitlist_position: { gt: next.waitlist_position! },
    },
    data: { waitlist_position: { decrement: 1 } },
  });
};

export const cancelReservation = async (reservationId: string, volunteerId: string) => {
  const deleted = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new Error('RESERVATION_NOT_FOUND');
    if (reservation.volunteer_id !== volunteerId) throw new Error('FORBIDDEN');

    await tx.reservation.delete({ where: { id: reservationId } });

    // Free up a spot — promote next waitlisted person
    if (reservation.status === 'pending' || reservation.status === 'approved') {
      await promoteFromWaitlist(tx, reservation.shift_id);
    }

    // Close the gap if they were on the waitlist
    if (reservation.status === 'waitlisted' && reservation.waitlist_position != null) {
      await tx.reservation.updateMany({
        where: {
          shift_id: reservation.shift_id,
          status: 'waitlisted',
          waitlist_position: { gt: reservation.waitlist_position },
        },
        data: { waitlist_position: { decrement: 1 } },
      });
    }

    return reservation;
  });

  emitHeadcount(getIO(), deleted.shift_id).catch(() => {});
  return deleted;
};

export const getMyReservations = async (volunteerId: string) => {
  return prisma.reservation.findMany({
    where: { volunteer_id: volunteerId },
    include: {
      shift: {
        include: { org: { select: { name: true, cause_area: true, logo_url: true } } },
      },
      position: { select: { id: true, name: true } },
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
      position: { select: { id: true, name: true } },
    },
    orderBy: [{ status: 'asc' }, { created_at: 'asc' }],
  });
};
