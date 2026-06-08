import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { ShiftStatus } from '@prisma/client';

const getAdminOrg = async (adminUserId: string) => {
  return prisma.organization.findUnique({ where: { admin_user_id: adminUserId } });
};

export const createShift = async (req: AuthenticatedRequest, res: Response) => {
  const { title, description, date, location, capacity } = req.body;

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
        description,
        date: new Date(date),
        location,
        capacity: parseInt(capacity),
        status: 'draft',
      },
    });

    res.status(201).json(shift);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create shift', error: err });
  }
};

export const getAllShifts = async (req: AuthenticatedRequest, res: Response) => {
  const { date, location, cause_area } = req.query;

  try {
    const shifts = await prisma.shift.findMany({
      where: {
        status: 'open',
        ...(location && { location: { contains: location as string, mode: 'insensitive' } }),
        ...(date && { date: { gte: new Date(date as string) } }),
        ...(cause_area && {
          org: { cause_area: { contains: cause_area as string, mode: 'insensitive' } },
        }),
      },
      include: {
        org: { select: { name: true, cause_area: true } },
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
        org: { select: { name: true, cause_area: true, logo_url: true } },
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
  const { title, description, date, location, capacity } = req.body;

  try {
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift) {
      res.status(404).json({ message: 'Shift not found' });
      return;
    }

    const org = await getAdminOrg(req.user!.id);
    if (!org || shift.org_id !== org.id) {
      res.status(403).json({ message: 'You do not own this shift' });
      return;
    }

    const updated = await prisma.shift.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(date && { date: new Date(date) }),
        ...(location && { location }),
        ...(capacity && { capacity: parseInt(capacity) }),
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
    if (!shift) {
      res.status(404).json({ message: 'Shift not found' });
      return;
    }

    const org = await getAdminOrg(req.user!.id);
    if (!org || shift.org_id !== org.id) {
      res.status(403).json({ message: 'You do not own this shift' });
      return;
    }

    const updated = await prisma.shift.update({
      where: { id },
      data: { status },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update shift status', error: err });
  }
};

export const deleteShift = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const shift = await prisma.shift.findUnique({ where: { id } });
    if (!shift) {
      res.status(404).json({ message: 'Shift not found' });
      return;
    }

    const org = await getAdminOrg(req.user!.id);
    if (!org || shift.org_id !== org.id) {
      res.status(403).json({ message: 'You do not own this shift' });
      return;
    }

    await prisma.shift.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete shift', error: err });
  }
};
