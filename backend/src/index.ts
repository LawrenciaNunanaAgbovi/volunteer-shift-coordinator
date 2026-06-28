import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes';
import orgRoutes from './routes/orgRoutes';
import shiftRoutes from './routes/shiftRoutes';
import reservationRoutes from './routes/reservationRoutes';
import userRoutes from './routes/userRoutes';
import aiRoutes from './routes/aiRoutes';
import { initSocket } from './lib/socket';
import { registerShiftSocketHandlers } from './sockets/shiftSocket';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = initSocket(server);
registerShiftSocketHandlers(io);

const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api', reservationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ai', aiRoutes);

// TODO: add Cloudinary upload endpoint (Phase 4)

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
