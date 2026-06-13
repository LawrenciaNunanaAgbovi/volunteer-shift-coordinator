import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  createReservation,
  cancelReservation,
  updateReservationStatus,
  getMyReservations,
  getShiftReservations,
} from '../services/reservationService';

const SERVICE_ERRORS: Record<string, [number, string]> = {
  SHIFT_NOT_FOUND:    [404, 'Shift not found'],
  SHIFT_NOT_OPEN:     [400, 'This shift is not open for reservations'],
  ALREADY_RESERVED:   [409, 'You already have a reservation for this shift'],
  POSITION_NOT_FOUND: [404, 'Position not found on this shift'],
  RESERVATION_NOT_FOUND: [404, 'Reservation not found'],
  FORBIDDEN:          [403, 'You do not have access to this resource'],
};

const handleServiceError = (err: unknown, res: Response) => {
  if (err instanceof Error && err.message in SERVICE_ERRORS) {
    const [status, message] = SERVICE_ERRORS[err.message];
    res.status(status).json({ message });
    return;
  }
  res.status(500).json({ message: 'Something went wrong', error: err });
};

// POST /api/shifts/:shiftId/reservations  (param-based)
export const reserve = async (req: AuthenticatedRequest, res: Response) => {
  const shiftId     = req.params.shiftId;
  const positionId  = req.body.position_id ?? null;
  const volunteerId = req.user!.id;

  try {
    const reservation = await createReservation(shiftId, volunteerId, positionId);
    res.status(201).json(reservation);
  } catch (err) {
    handleServiceError(err, res);
  }
};

// POST /api/reservations  (body-based — used by dashboard reserve button)
export const reserveByBody = async (req: AuthenticatedRequest, res: Response) => {
  const shiftId     = req.body.shift_id;
  const positionId  = req.body.position_id ?? null;
  const volunteerId = req.user!.id;

  if (!shiftId) {
    res.status(400).json({ message: 'shift_id is required' });
    return;
  }

  try {
    const reservation = await createReservation(shiftId, volunteerId, positionId);
    res.status(201).json(reservation);
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const cancel = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    await cancelReservation(id, req.user!.id);
    res.status(204).send();
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const updateStatus = async (req: AuthenticatedRequest, res: Response) => {
  const { id }     = req.params;
  const { status } = req.body;
  const adminUserId = req.user!.id;

  if (!['approved', 'denied'].includes(status)) {
    res.status(400).json({ message: 'status must be approved or denied' });
    return;
  }

  try {
    const updated = await updateReservationStatus(id, status, adminUserId);
    res.json(updated);
  } catch (err) {
    handleServiceError(err, res);
  }
};

export const myReservations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const reservations = await getMyReservations(req.user!.id);
    res.json(reservations);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reservations', error: err });
  }
};

export const shiftReservations = async (req: AuthenticatedRequest, res: Response) => {
  const shiftId = req.params.shiftId;

  try {
    const reservations = await getShiftReservations(shiftId, req.user!.id);
    res.json(reservations);
  } catch (err) {
    handleServiceError(err, res);
  }
};
