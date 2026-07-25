import { prismaMock, resetPrismaMock } from '../test/prismaMock';

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: prismaMock,
}));
jest.mock('../lib/socket', () => ({ getIO: jest.fn() }));
jest.mock('../sockets/shiftSocket', () => ({
  emitHeadcount: jest.fn().mockResolvedValue(undefined),
}));

import {
  createReservation,
  updateReservationStatus,
  cancelReservation,
} from './reservationService';

beforeEach(() => {
  resetPrismaMock();
});

const baseShift = {
  id: 'shift-1',
  status: 'open',
  capacity: 2,
} as any;

describe('createReservation', () => {
  it('throws when the shift does not exist', async () => {
    prismaMock.shift.findUnique.mockResolvedValue(null);

    await expect(createReservation('shift-1', 'vol-1')).rejects.toThrow('SHIFT_NOT_FOUND');
  });

  it('throws when the shift is not open', async () => {
    prismaMock.shift.findUnique.mockResolvedValue({ ...baseShift, status: 'draft' });

    await expect(createReservation('shift-1', 'vol-1')).rejects.toThrow('SHIFT_NOT_OPEN');
  });

  it('throws when the volunteer already has a reservation for this shift', async () => {
    prismaMock.shift.findUnique.mockResolvedValue(baseShift);
    prismaMock.reservation.findFirst.mockResolvedValue({ id: 'existing' } as any);

    await expect(createReservation('shift-1', 'vol-1')).rejects.toThrow('ALREADY_RESERVED');
  });

  it('creates a pending reservation when the shift has open capacity', async () => {
    prismaMock.shift.findUnique.mockResolvedValue(baseShift);
    prismaMock.reservation.findFirst.mockResolvedValue(null);
    prismaMock.reservation.count.mockResolvedValue(1); // 1 active < capacity 2
    prismaMock.reservation.create.mockResolvedValue({ id: 'res-1', status: 'pending' } as any);

    const result = await createReservation('shift-1', 'vol-1');

    expect(prismaMock.reservation.create).toHaveBeenCalledWith({
      data: { shift_id: 'shift-1', volunteer_id: 'vol-1', status: 'pending' },
    });
    expect(result).toEqual({ id: 'res-1', status: 'pending' });
  });

  it('waitlists the volunteer once shift-level capacity is full', async () => {
    prismaMock.shift.findUnique.mockResolvedValue(baseShift);
    prismaMock.reservation.findFirst
      .mockResolvedValueOnce(null) // duplicate-reservation check
      .mockResolvedValueOnce({ waitlist_position: 2 } as any); // last waitlisted lookup
    prismaMock.reservation.count.mockResolvedValue(2); // at capacity
    prismaMock.reservation.create.mockResolvedValue({ id: 'res-2', status: 'waitlisted' } as any);

    await createReservation('shift-1', 'vol-2');

    expect(prismaMock.reservation.create).toHaveBeenCalledWith({
      data: {
        shift_id: 'shift-1',
        volunteer_id: 'vol-2',
        status: 'waitlisted',
        waitlist_position: 3,
      },
    });
  });

  it('starts the waitlist at position 1 when no one is waitlisted yet', async () => {
    prismaMock.shift.findUnique.mockResolvedValue(baseShift);
    prismaMock.reservation.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.reservation.count.mockResolvedValue(2);
    prismaMock.reservation.create.mockResolvedValue({ id: 'res-3', status: 'waitlisted' } as any);

    await createReservation('shift-1', 'vol-3');

    expect(prismaMock.reservation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ waitlist_position: 1 }),
    });
  });

  it('checks position-level capacity instead of shift-level when a position is requested', async () => {
    prismaMock.shift.findUnique.mockResolvedValue(baseShift);
    prismaMock.reservation.findFirst.mockResolvedValue(null);
    prismaMock.shiftPosition.findUnique.mockResolvedValue({
      id: 'pos-1',
      shift_id: 'shift-1',
      capacity: 1,
    } as any);
    prismaMock.reservation.count.mockResolvedValue(0);
    prismaMock.reservation.create.mockResolvedValue({ id: 'res-4', status: 'pending' } as any);

    await createReservation('shift-1', 'vol-4', 'pos-1');

    expect(prismaMock.reservation.create).toHaveBeenCalledWith({
      data: {
        shift_id: 'shift-1',
        volunteer_id: 'vol-4',
        position_id: 'pos-1',
        status: 'pending',
      },
    });
  });
});

describe('updateReservationStatus', () => {
  it('promotes the next waitlisted reservation when a reservation is denied', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: 'res-1',
      shift_id: 'shift-1',
      shift: { org: { admin_user_id: 'admin-1' } },
    } as any);
    prismaMock.reservation.update.mockResolvedValue({ id: 'res-1', shift_id: 'shift-1' } as any);
    prismaMock.reservation.findFirst.mockResolvedValue({
      id: 'waitlisted-res',
      waitlist_position: 1,
    } as any);

    await updateReservationStatus('res-1', 'denied', 'admin-1');

    expect(prismaMock.reservation.update).toHaveBeenCalledWith({
      where: { id: 'waitlisted-res' },
      data: { status: 'pending', waitlist_position: null },
    });
  });

  it('rejects when the acting admin does not own the shift', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: 'res-1',
      shift_id: 'shift-1',
      shift: { org: { admin_user_id: 'someone-else' } },
    } as any);

    await expect(updateReservationStatus('res-1', 'denied', 'admin-1')).rejects.toThrow('FORBIDDEN');
  });
});

describe('cancelReservation', () => {
  it('promotes the next waitlisted volunteer when a confirmed reservation is cancelled', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: 'res-1',
      shift_id: 'shift-1',
      volunteer_id: 'vol-1',
      status: 'approved',
      waitlist_position: null,
    } as any);
    prismaMock.reservation.findFirst.mockResolvedValue({
      id: 'waitlisted-res',
      waitlist_position: 1,
    } as any);

    await cancelReservation('res-1', 'vol-1');

    expect(prismaMock.reservation.delete).toHaveBeenCalledWith({ where: { id: 'res-1' } });
    expect(prismaMock.reservation.update).toHaveBeenCalledWith({
      where: { id: 'waitlisted-res' },
      data: { status: 'pending', waitlist_position: null },
    });
  });

  it('closes the gap in the waitlist queue when a waitlisted reservation is cancelled', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: 'res-2',
      shift_id: 'shift-1',
      volunteer_id: 'vol-2',
      status: 'waitlisted',
      waitlist_position: 2,
    } as any);

    await cancelReservation('res-2', 'vol-2');

    expect(prismaMock.reservation.updateMany).toHaveBeenCalledWith({
      where: { shift_id: 'shift-1', status: 'waitlisted', waitlist_position: { gt: 2 } },
      data: { waitlist_position: { decrement: 1 } },
    });
  });

  it('rejects when a volunteer tries to cancel someone else\'s reservation', async () => {
    prismaMock.reservation.findUnique.mockResolvedValue({
      id: 'res-1',
      volunteer_id: 'vol-1',
      status: 'pending',
    } as any);

    await expect(cancelReservation('res-1', 'someone-else')).rejects.toThrow('FORBIDDEN');
  });
});
