# Volunteer Shift Coordinator

A full-stack web app that gives nonprofits real headcount visibility before an event and gives volunteers a clear, committed path from sign-up to show up.

## Why I Built This

As a Bonner Scholar at Stetson University, I've spent the last four years showing up to volunteer shifts at food drives, community events, and tutoring programs. And almost every single time, the coordination was a mess on both sides.

Orgs were managing sign-ups through Google Forms, group chats, and spreadsheets with no real visibility into whether a shift was covered until the day of. But as a volunteer, it was just as frustrating — showing up to a site that had no idea you were coming, getting turned away because they'd accidentally overbooked, standing around waiting to be placed because no one had matched skills to roles beforehand.

There was no system. Just vibes and last-minute texts.

I built this to fix that specific gap.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Real-time | Socket.io |
| AI | OpenAI API (GPT-4o) |
| Auth | JWT + bcrypt |
| Storage | AWS S3 |

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Setup

```bash
git clone <repo-url>
cd volunteer-coordinator

# Backend
cd backend
cp .env.example .env        # fill in DATABASE_URL and JWT_SECRET
npm install
npm run db:migrate
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Build Phases

- [x] Phase 1 — Foundation: JWT auth, Prisma schema, User/Org/Shift CRUD
- [ ] Phase 2 — Reservation system + waitlist auto-promotion
- [ ] Phase 3 — Real-time headcount via Socket.io
- [ ] Phase 4 — AI features: shift description generator + volunteer matcher
- [ ] Phase 5 — Polish: email reminders, analytics dashboard, responsive design

## License

MIT
