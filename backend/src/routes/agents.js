const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Simple agent registry
const agentRegistry = new Map();

/**
 * POST /api/agents/register
 * Register an agent with its capabilities
 */
router.post('/register', [
  body('name').isString().isLength({ min: 2, max: 100 }),
  body('type').isIn(['requester', 'solver', 'both']),
  body('capabilities').isArray(),
  body('wallet_address').isString(),
  body('endpoint_url').optional().isURL(),
  body('description').optional().isString(),
], (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, type, capabilities, wallet_address, endpoint_url, description } = req.body;

    const agent = {
      id: uuidv4(),
      name,
      type,
      capabilities,
      wallet_address,
      endpoint_url,
      description,
      registered_at: new Date().toISOString(),
      tasks_completed: 0,
      reputation_score: 0.5,
    };

    agentRegistry.set(agent.id, agent);
    res.status(201).json({ agent_id: agent.id, agent });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/agents
 */
router.get('/', (req, res) => {
  const { type, capability } = req.query;
  let agents = Array.from(agentRegistry.values());

  if (type) agents = agents.filter(a => a.type === type || a.type === 'both');
  if (capability) agents = agents.filter(a => a.capabilities.includes(capability));

  res.json({ total: agents.length, agents });
});

/**
 * GET /api/agents/:id
 */
router.get('/:id', (req, res) => {
  const agent = agentRegistry.get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
});

module.exports = router;
