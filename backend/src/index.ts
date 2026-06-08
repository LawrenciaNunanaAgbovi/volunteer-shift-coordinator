import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes';
import orgRoutes from './routes/orgRoutes';
import shiftRoutes from './routes/shiftRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/shifts', shiftRoutes);

// TODO: mount reservation routes here (Phase 2)
// TODO: wire up Socket.io for live headcount (Phase 3)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
