const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const taskStore = require('../services/taskStore');
const circleService = require('../services/circleService');
const judgeService = require('../services/judgeService');

const router = express.Router();

// In-memory store (replace with DB in prod)
const tasks = taskStore;

/**
 * POST /api/tasks
 * Publish a new task (Requester agent calls this)
 */
router.post('/', [
  body('title').isString().isLength({ min: 5, max: 200 }),
  body('description').isString().isLength({ min: 10, max: 5000 }),
  body('reward').isFloat({ min: 0.0001 }),
  body('currency').optional().isIn(['USDC']).default('USDC'),
  body('deadline_hours').optional().isInt({ min: 1, max: 720 }).default(24),
  body('requester_wallet').isString(),
  body('evaluation_rubric').isString().isLength({ min: 10 }),
  body('capabilities_required').optional().isArray(),
  body('max_solvers').optional().isInt({ min: 1, max: 10 }).default(1),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      title, description, reward, currency = 'USDC',
      deadline_hours = 24, requester_wallet,
      evaluation_rubric, capabilities_required = [], max_solvers = 1
    } = req.body;

    // Create escrow wallet for this task
    const escrowWallet = await circleService.createEscrowWallet();

    const task = {
      id: uuidv4(),
      title,
      description,
      reward: parseFloat(reward),
      currency,
      status: 'open',            // open | claimed | submitted | completed | disputed | expired
      requester_wallet,
      escrow_wallet: escrowWallet.id,
      escrow_address: escrowWallet.address,
      evaluation_rubric,
      capabilities_required,
      max_solvers,
      solvers: [],
      submissions: [],
      created_at: new Date().toISOString(),
      deadline: new Date(Date.now() + deadline_hours * 3600 * 1000).toISOString(),
      platform_fee: parseFloat((reward * (process.env.PLATFORM_FEE_PERCENT || 2) / 100).toFixed(6)),
    };

    tasks.set(task.id, task);

    res.status(201).json({
      task_id: task.id,
      escrow_address: task.escrow_address,
      message: `Send exactly ${task.reward} ${task.currency} to the escrow address to activate task`,
      task
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/tasks
 * List open tasks (Solver agents browse this)
 */
router.get('/', [
  query('status').optional().isIn(['open', 'claimed', 'submitted', 'completed', 'disputed', 'expired']),
  query('capabilities').optional().isString(),
  query('min_reward').optional().isFloat(),
  query('max_reward').optional().isFloat(),
  query('limit').optional().isInt({ min: 1, max: 100 }).default(20),
  query('offset').optional().isInt({ min: 0 }).default(0),
], (req, res) => {
  const { status = 'open', capabilities, min_reward, max_reward, limit = 20, offset = 0 } = req.query;

  let result = Array.from(tasks.values()).filter(t => t.status === status);

  if (capabilities) {
    const caps = capabilities.split(',').map(c => c.trim());
    result = result.filter(t =>
      t.capabilities_required.length === 0 ||
      t.capabilities_required.some(c => caps.includes(c))
    );
  }
  if (min_reward) result = result.filter(t => t.reward >= parseFloat(min_reward));
  if (max_reward) result = result.filter(t => t.reward <= parseFloat(max_reward));

  // Sort by reward DESC
  result.sort((a, b) => b.reward - a.reward);

  res.json({
    total: result.length,
    tasks: result.slice(offset, offset + parseInt(limit))
  });
});

/**
 * GET /api/tasks/:id
 */
router.get('/:id', param('id').isUUID(), (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

/**
 * POST /api/tasks/:id/claim
 * Solver agent claims a task
 */
router.post('/:id/claim', [
  param('id').isUUID(),
  body('solver_wallet').isString(),
  body('solver_id').isString(),
  body('solver_capabilities').optional().isArray(),
  body('estimated_completion_minutes').optional().isInt({ min: 1 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const task = tasks.get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status !== 'open') return res.status(409).json({ error: `Task is ${task.status}, cannot claim` });
    if (new Date(task.deadline) < new Date()) return res.status(410).json({ error: 'Task deadline passed' });

    const { solver_wallet, solver_id, solver_capabilities = [], estimated_completion_minutes } = req.body;

    task.solvers.push({ solver_id, solver_wallet, solver_capabilities, claimed_at: new Date().toISOString() });
    if (task.solvers.length >= task.max_solvers) {
      task.status = 'claimed';
    }

    tasks.set(task.id, task);

    res.json({
      message: 'Task claimed successfully',
      task_id: task.id,
      solver_deadline: new Date(Date.now() + (estimated_completion_minutes || 60) * 60 * 1000).toISOString(),
      task
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/tasks/:id/submit
 * Solver submits result
 */
router.post('/:id/submit', [
  param('id').isUUID(),
  body('solver_id').isString(),
  body('result').isString().isLength({ min: 1 }),
  body('result_url').optional().isURL(),
  body('proof_hash').optional().isString(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const task = tasks.get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!['open', 'claimed'].includes(task.status)) {
      return res.status(409).json({ error: `Task is ${task.status}, cannot submit` });
    }

    const { solver_id, result, result_url, proof_hash } = req.body;

    const submission = {
      id: uuidv4(),
      solver_id,
      result,
      result_url,
      proof_hash,
      submitted_at: new Date().toISOString(),
      judge_score: null,
      judge_reasoning: null,
    };

    task.submissions.push(submission);
    task.status = 'submitted';
    tasks.set(task.id, task);

    // Trigger async LLM judge
    judgeService.evaluate(task.id, submission.id).catch(err =>
      console.error(`Judge error for task ${task.id}:`, err)
    );

    res.json({
      submission_id: submission.id,
      message: 'Submission received, LLM judge evaluating...',
      task_id: task.id
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/tasks/:id/dispute
 * Requester opens a dispute
 */
router.post('/:id/dispute', [
  param('id').isUUID(),
  body('requester_wallet').isString(),
  body('reason').isString().isLength({ min: 10 }),
], async (req, res, next) => {
  try {
    const task = tasks.get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (task.status !== 'submitted') return res.status(409).json({ error: 'Can only dispute submitted tasks' });
    if (task.requester_wallet !== req.body.requester_wallet) {
      return res.status(403).json({ error: 'Only the requester can dispute' });
    }

    task.status = 'disputed';
    task.dispute = { reason: req.body.reason, opened_at: new Date().toISOString() };
    tasks.set(task.id, task);

    // Re-evaluate with judge, with extra context
    const submission = task.submissions[task.submissions.length - 1];
    judgeService.evaluate(task.id, submission.id, { dispute_reason: req.body.reason })
      .catch(console.error);

    res.json({ message: 'Dispute opened, judge re-evaluating', task_id: task.id });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/tasks/stats/summary
 */
router.get('/stats/summary', (req, res) => {
  const all = Array.from(tasks.values());
  res.json({
    total: all.length,
    by_status: all.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {}),
    total_value_locked: all
      .filter(t => ['claimed', 'submitted', 'disputed'].includes(t.status))
      .reduce((sum, t) => sum + t.reward, 0)
      .toFixed(6),
    total_completed_value: all
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.reward, 0)
      .toFixed(6),
  });
});

module.exports = router;
