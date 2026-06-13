import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { ShiftStatus, ShiftCategory } from '@prisma/client';

const getAdminOrg = async (adminUserId: string) => {
  return prisma.organization.findUnique({ where: { admin_user_id: adminUserId } });
};

const ORG_SELECT = { name: true, cause_area: true, logo_url: true, description: true };

const POSITION_INCLUDE = {
  include: { _count: { select: { reservations: true } } },
} as const;

// ── Shifts ───────────────────────────────────────────────────────────────────

export const createShift = async (req: AuthenticatedRequest, res: Response) => {
  const {
    title, description, date, location, capacity,
    start_time, end_time, duration,
    requirements, what_to_bring, category,
    is_recurring, contact_name, contact_email,
    positions,
  } = req.body;

  if (!title || !date || !location || !capacity) {
    res.status(400).json({ message: 'title, date, location, and capacity are required' });
    return;
  }

  try {
    const org = await getAdminOrg(req.user!.id);
    if (!org) {
      res.status(404).json({ message: 'You must create an organization before adding shifts' });
      return;
    }

    const shift = await prisma.shift.create({
      data: {
        org_id: org.id,
        title,
        description: description ?? null,
        date: new Date(date),
        location,
        capacity: parseInt(capacity),
        start_time: start_time ?? null,
        end_time: end_time ?? null,
        duration: duration != null ? parseInt(duration) : null,
        requirements: requirements ?? null,
        what_to_bring: what_to_bring ?? null,
        category: (category as ShiftCategory) ?? 'other',
        is_recurring: Boolean(is_recurring),
        contact_name: contact_name ?? null,
        contact_email: contact_email ?? null,
        status: 'draft',
        ...(Array.isArray(positions) && positions.length > 0 && {
          positions: {
            create: positions.map((p: { name: string; description?: string; capacity: number }) => ({
              name: p.name,
              description: p.description ?? null,
              capacity: parseInt(String(p.capacity)),
            })),
          },
        }),
      },
      include: {
        org: { select: ORG_SELECT },
        positions: POSITION_INCLUDE,
      },
    });

    res.status(201).json(shift);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create shift', error: err });
  }
};

export const getAllShifts = async (req: AuthenticatedRequest, res: Response) => {
  const { date, location, cause_area, category } = req.query;

  try {
    const shifts = await prisma.shift.findMany({
      where: {
        status: 'open',
        ...(location && { location: { contains: location as string, mode: 'insensitive' } }),
        ...(date && { date: { gte: new Date(date as string) } }),
        ...(cause_area && {
          org: { cause_area: { contains: cause_area as string, mode: 'insensitive' } },
        }),
        ...(category && { category: category as ShiftCategory }),
      },
      include: {
        org: { select: ORG_SELECT },
        positions: POSITION_INCLUDE,
        _count: { select: { reservations: true } },
      },
      orderBy: { date: 'asc' },
    });

    res.json(shifts);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch shifts', error: err });
  }
};

export const getShiftById = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        org: { select: ORG_SELECT },
        positions: POSITION_INCLUDE,
        _count: { select: { reservations: true } },
      },
    });

    if (!shift) {
      res.status(404).json({ message: 'Shift not found' });
      return;
    }

    res.json(shift);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch shift', error: err });
  }
};

export const updateShift = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const {
    title, description, date, location, capacity,
    start_time, end_time, duration,
    requirements, what_to_bring, category,
    is_recurring, contact_name, contact_email,
  } = req.body;

  try {
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift) { res.status(404).json({ message: 'Shift not found' }); return; }

    const org = await getAdminOrg(req.user!.id);
    if (!org || shift.org_id !== org.id) { res.status(403).json({ message: 'You do not own this shift' }); return; }

    const updated = await prisma.shift.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(date && { date: new Date(date) }),
        ...(location && { location }),
        ...(capacity && { capacity: parseInt(capacity) }),
        ...(start_time !== undefined && { start_time }),
        ...(end_time !== undefined && { end_time }),
        ...(duration !== undefined && { duration: duration != null ? parseInt(duration) : null }),
        ...(requirements !== undefined && { requirements }),
        ...(what_to_bring !== undefined && { what_to_bring }),
        ...(category && { category: category as ShiftCategory }),
        ...(is_recurring !== undefined && { is_recurring: Boolean(is_recurring) }),
        ...(contact_name !== undefined && { contact_name }),
        ...(contact_email !== undefined && { contact_email }),
      },
      include: {
        org: { select: ORG_SELECT },
        positions: POSITION_INCLUDE,
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update shift', error: err });
  }
};

export const updateShiftStatus = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!Object.values(ShiftStatus).includes(status)) {
    res.status(400).json({ message: 'status must be draft, open, or closed' });
    return;
  }

  try {
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift) { res.status(404).json({ message: 'Shift not found' }); return; }

    const org = await getAdminOrg(req.user!.id);
    if (!org || shift.org_id !== org.id) { res.status(403).json({ message: 'You do not own this shift' }); return; }

    const updated = await prisma.shift.update({ where: { id }, data: { status } });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update shift status', error: err });
  }
};

export const deleteShift = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift) { res.status(404).json({ message: 'Shift not found' }); return; }

    const org = await getAdminOrg(req.user!.id);
    if (!org || shift.org_id !== org.id) { res.status(403).json({ message: 'You do not own this shift' }); return; }

    await prisma.shift.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete shift', error: err });
  }
};

// ── Shift Positions ──────────────────────────────────────────────────────────

const getOwnedPosition = async (shiftId: string, posId: string, adminUserId: string) => {
  const position = await prisma.shiftPosition.findUnique({
    where: { id: posId },
    include: { shift: true },
  });
  if (!position || position.shift_id !== shiftId) return null;
  const org = await getAdminOrg(adminUserId);
  if (!org || position.shift.org_id !== org.id) return null;
  return position;
};

export const addPosition = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, description, capacity } = req.body;

  if (!name || !capacity) {
    res.status(400).json({ message: 'name and capacity are required' });
    return;
  }

  try {
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift) { res.status(404).json({ message: 'Shift not found' }); return; }

    const org = await getAdminOrg(req.user!.id);
    if (!org || shift.org_id !== org.id) { res.status(403).json({ message: 'You do not own this shift' }); return; }

    const position = await prisma.shiftPosition.create({
      data: { shift_id: id, name, description: description ?? null, capacity: parseInt(capacity) },
    });

    res.status(201).json(position);
  } catch (err) {
    res.status(500).json({ message: 'Failed to add position', error: err });
  }
};

export const updatePosition = async (req: AuthenticatedRequest, res: Response) => {
  const { id, posId } = req.params;
  const { name, description, capacity } = req.body;

  try {
    const position = await getOwnedPosition(id, posId, req.user!.id);
    if (!position) { res.status(404).json({ message: 'Position not found or access denied' }); return; }

    const updated = await prisma.shiftPosition.update({
      where: { id: posId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(capacity && { capacity: parseInt(capacity) }),
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update position', error: err });
  }
};

export const removePosition = async (req: AuthenticatedRequest, res: Response) => {
  const { id, posId } = req.params;

  try {
    const position = await getOwnedPosition(id, posId, req.user!.id);
    if (!position) { res.status(404).json({ message: 'Position not found or access denied' }); return; }

    await prisma.shiftPosition.delete({ where: { id: posId } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove position', error: err });
  }
};
