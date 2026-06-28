import Anthropic from '@anthropic-ai/sdk'
import { Response } from 'express'
import prisma from '../lib/prisma'
import { AuthenticatedRequest } from '../middleware/auth'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Generate description ─────────────────────────────────────────────────────

export const generateDescription = async (req: AuthenticatedRequest, res: Response) => {
  const { title, category, location, date, org_name, extra_notes } = req.body

  if (!title) { res.status(400).json({ message: 'title is required' }); return }

  const context = [
    `Shift title: ${title}`,
    category  ? `Category: ${category}`       : null,
    location  ? `Location: ${location}`        : null,
    date      ? `Date: ${new Date(date).toDateString()}` : null,
    org_name  ? `Organization: ${org_name}`   : null,
    extra_notes ? `Extra notes from organizer: ${extra_notes}` : null,
  ].filter(Boolean).join('\n')

  try {
    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system:     'You are a volunteer shift description writer for a nonprofit coordination platform. Return ONLY a valid JSON object with exactly three keys: "description", "requirements", "what_to_bring". Each value must be a valid HTML string using only <p>, <strong>, <em>, <ul>, <ol>, <li> tags. Be friendly, encouraging, and specific to the shift context. Keep each field concise — 2-4 sentences or a short bullet list. Do not include any text outside the JSON object.',
      messages: [
        {
          role:    'user',
          content: `Generate a shift description for the following:\n\n${context}\n\nReturn JSON only.`,
        },
      ],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) { res.status(500).json({ message: 'AI returned unexpected format' }); return }

    const result = JSON.parse(jsonMatch[0])
    res.json(result)
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate description', error: err })
  }
}

// ── Recommendations ──────────────────────────────────────────────────────────

export const getRecommendations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        skills: true,
        reservations: {
          select: {
            shift_id: true,
            shift: { select: { category: true } },
          },
        },
      },
    })

    const reservedIds    = new Set((user?.reservations ?? []).map(r => r.shift_id))
    const pastCategories = [...new Set((user?.reservations ?? []).map(r => r.shift.category))]

    const shifts = await prisma.shift.findMany({
      where: {
        status: 'open',
        date:   { gte: new Date() },
        id:     { notIn: [...reservedIds] },
      },
      select: {
        id:           true,
        title:        true,
        category:     true,
        location:     true,
        date:         true,
        requirements: true,
        org:          { select: { name: true } },
      },
      orderBy: { date: 'asc' },
      take: 40,
    })

    if (shifts.length === 0) { res.json([]); return }

    const shiftLines = shifts.map((s, i) =>
      `${i + 1}. ID: ${s.id} | Title: ${s.title} | Category: ${s.category} | Org: ${s.org?.name ?? 'Unknown'} | Location: ${s.location} | Date: ${new Date(s.date).toDateString()}${s.requirements ? ` | Requirements: ${s.requirements.replace(/<[^>]+>/g, '').slice(0, 120)}` : ''}`
    ).join('\n')

    const volunteerContext = [
      user?.skills?.length ? `Skills: ${user.skills.join(', ')}` : 'Skills: not specified',
      pastCategories.length ? `Past volunteer categories: ${pastCategories.join(', ')}` : 'No past volunteer history',
    ].join('\n')

    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:     'You are a volunteer shift matching assistant. Based on the volunteer\'s profile, recommend up to 5 shifts from the list that are the best fit. Return ONLY a valid JSON array in this exact format, no extra text: [{"shiftId":"...","reason":"one short sentence why this matches"}]. If nothing is a good fit, return an empty array [].',
      messages: [
        {
          role:    'user',
          content: `Volunteer profile:\n${volunteerContext}\n\nAvailable shifts:\n${shiftLines}\n\nReturn up to 5 best-matched shifts as JSON.`,
        },
      ],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) { res.json([]); return }

    const picks: { shiftId: string; reason: string }[] = JSON.parse(jsonMatch[0])

    // Hydrate with full shift data
    const pickIds    = picks.map(p => p.shiftId)
    const fullShifts = await prisma.shift.findMany({
      where: { id: { in: pickIds } },
      include: {
        org:       { select: { name: true, cause_area: true } },
        positions: { include: { _count: { select: { reservations: true } } } },
        _count:    { select: { reservations: true } },
      },
    })

    const shiftMap = new Map(fullShifts.map(s => [s.id, s]))
    const result = picks
      .filter(p => shiftMap.has(p.shiftId))
      .map(p => ({ ...shiftMap.get(p.shiftId)!, reason: p.reason }))

    res.json(result)
  } catch (err) {
    res.status(500).json({ message: 'Failed to get recommendations', error: err })
  }
}
