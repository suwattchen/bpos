import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

// Routes
import authRoutes from './routes/auth';
import productsRoutes from './routes/products';
import inventoryRoutes from './routes/inventory';
import transactionsRoutes from './routes/transactions';
import customersRoutes from './routes/customers';
import categoriesRoutes from './routes/categories';
import uploadRoutes from './routes/upload';
import healthRoutes from './routes/health';

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin.split(','),
  credentials: true,
}));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('combined'));
}

// Routes
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/products', productsRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/transactions', transactionsRoutes);
app.use('/customers', customersRoutes);
app.use('/categories', categoriesRoutes);
app.use('/upload', uploadRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = config.port || 3001;

if (config.nodeEnv !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${config.nodeEnv}`);
    console.log(`🔗 Database: ${config.database.host}:${config.database.port}`);
  });
}

export default app;
