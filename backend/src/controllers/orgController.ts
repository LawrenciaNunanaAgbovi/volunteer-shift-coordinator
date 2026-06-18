import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';

export const createOrg = async (req: AuthenticatedRequest, res: Response) => {
  const { name, cause_area, description } = req.body;
  const adminUserId = req.user!.id;

  if (!name || !cause_area) {
    res.status(400).json({ message: 'name and cause_area are required' });
    return;
  }

  try {
    const existing = await prisma.organization.findUnique({
      where: { admin_user_id: adminUserId },
    });
    if (existing) {
      res.status(409).json({ message: 'You already have an organization' });
      return;
    }

    const org = await prisma.organization.create({
      data: { name, cause_area, description, admin_user_id: adminUserId },
    });

    res.status(201).json(org);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create organization', error: err });
  }
};

export const getMyOrgDashboard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { admin_user_id: req.user!.id },
    });

    if (!org) {
      res.status(404).json({ message: 'No organization found for this account' });
      return;
    }

    const shifts = await prisma.shift.findMany({
      where: { org_id: org.id },
      include: {
        positions: { include: { _count: { select: { reservations: true } } } },
        _count: { select: { reservations: true } },
      },
      orderBy: { date: 'asc' },
    });

    const pendingReservations = await prisma.reservation.findMany({
      where: {
        status: 'pending',
        shift: { org_id: org.id },
      },
      include: {
        volunteer: { select: { id: true, name: true, email: true } },
        shift:     { select: { id: true, title: true, date: true, start_time: true } },
        position:  { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    res.json({ org, shifts, pendingReservations });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load dashboard', error: err });
  }
};

export const getAllOrgs = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        cause_area: true,
        description: true,
        logo_url: true,
      },
    });
    res.json(orgs);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch organizations', error: err });
  }
};

export const getOrgById = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        shifts: {
          where: { status: 'open' },
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!org) {
      res.status(404).json({ message: 'Organization not found' });
      return;
    }

    res.json(org);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch organization', error: err });
  }
};

export const updateOrg = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, cause_area, description } = req.body;

  try {
    const org = await prisma.organization.findUnique({ where: { id } });

    if (!org) {
      res.status(404).json({ message: 'Organization not found' });
      return;
    }

    if (org.admin_user_id !== req.user!.id) {
      res.status(403).json({ message: 'You do not own this organization' });
      return;
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: { name, cause_area, description },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update organization', error: err });
  }
};

export const deleteOrg = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const org = await prisma.organization.findUnique({ where: { id } });

    if (!org) {
      res.status(404).json({ message: 'Organization not found' });
      return;
    }

    if (org.admin_user_id !== req.user!.id) {
      res.status(403).json({ message: 'You do not own this organization' });
      return;
    }

    await prisma.organization.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete organization', error: err });
  }
};
