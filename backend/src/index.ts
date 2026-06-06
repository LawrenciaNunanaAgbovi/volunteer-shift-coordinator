import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// TODO: mount auth, org, and shift routes here (Phase 1)
// TODO: mount reservation routes here (Phase 2)
// TODO: wire up Socket.io for live headcount (Phase 3)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
