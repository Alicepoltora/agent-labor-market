require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const tasksRouter = require('./routes/tasks');
const walletsRouter = require('./routes/wallets');
const judgeRouter = require('./routes/judge');
const agentsRouter = require('./routes/agents');
const { errorHandler } = require('./middleware/errorHandler');
const { startExpiryWatcher } = require('./services/expiryWatcher');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    network: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/tasks', tasksRouter);
app.use('/api/wallets', walletsRouter);
app.use('/api/judge', judgeRouter);
app.use('/api/agents', agentsRouter);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🤖 Agent Labor Market API running on port ${PORT}`);
  console.log(`📋 Health: http://localhost:${PORT}/health`);
  console.log(`📚 Docs:   http://localhost:${PORT}/api/docs\n`);

  // Start background services
  startExpiryWatcher();
});

module.exports = app;
