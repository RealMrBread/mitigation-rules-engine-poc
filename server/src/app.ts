import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error-handler.middleware.js';
import authRoutes from './routes/auth.routes.js';
import ruleRoutes from './routes/rule.routes.js';
import releaseRoutes from './routes/release.routes.js';
import evaluationRoutes from './routes/evaluation.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/releases', releaseRoutes);
app.use('/api', evaluationRoutes);

app.use(errorHandler);

export default app;
