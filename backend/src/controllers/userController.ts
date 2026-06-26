import { Response } from 'express'
import prisma from '../lib/prisma'
import { AuthenticatedRequest } from '../middleware/auth'

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        skills: true,
        created_at: true,
        _count: { select: { reservations: true } },
      },
    })
    if (!user) { res.status(404).json({ message: 'User not found' }); return }
    res.json(user)
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch profile', error: err })
  }
}

export const updateMe = async (req: AuthenticatedRequest, res: Response) => {
  const { name, skills } = req.body

  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    res.status(400).json({ message: 'name must be a non-empty string' }); return
  }
  if (skills !== undefined && !Array.isArray(skills)) {
    res.status(400).json({ message: 'skills must be an array' }); return
  }

  try {
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(skills !== undefined && { skills }),
      },
      select: { id: true, name: true, email: true, role: true, skills: true, created_at: true },
    })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile', error: err })
  }
}
