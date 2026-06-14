const express = require('express');
const { body, param, validationResult } = require('express-validator');
const judgeService = require('../services/judgeService');
const taskStore = require('../services/taskStore');

const router = express.Router();

/**
 * POST /api/judge/evaluate
 * Manually trigger evaluation (admin/debug endpoint)
 */
router.post('/evaluate', [
  body('task_id').isUUID(),
  body('submission_id').isUUID(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const result = await judgeService.evaluate(req.body.task_id, req.body.submission_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/judge/task/:taskId
 * Get judge verdicts for a task
 */
router.get('/task/:taskId', (req, res) => {
  const task = taskStore.get(req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  res.json({
    task_id: task.id,
    task_status: task.status,
    submissions: task.submissions.map(s => ({
      id: s.id,
      solver_id: s.solver_id,
      submitted_at: s.submitted_at,
      evaluated_at: s.evaluated_at,
      judge_score: s.judge_score,
      judge_verdict: s.judge_verdict,
      judge_reasoning: s.judge_reasoning,
    }))
  });
});

module.exports = router;
