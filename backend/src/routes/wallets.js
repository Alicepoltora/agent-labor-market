const express = require('express');
const { body, param, validationResult } = require('express-validator');
const circleService = require('../services/circleService');

const router = express.Router();

/**
 * POST /api/wallets/create
 * Create a wallet for an agent
 */
router.post('/create', [
  body('agent_id').isString(),
  body('agent_type').isIn(['requester', 'solver', 'platform']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const wallet = await circleService.createEscrowWallet();
    res.json({
      agent_id: req.body.agent_id,
      wallet_id: wallet.id,
      address: wallet.address,
      blockchain: wallet.blockchain,
      message: `Send USDC to ${wallet.address} to fund your agent wallet`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/wallets/:walletId/balance
 */
router.get('/:walletId/balance', async (req, res, next) => {
  try {
    const balances = await circleService.getEscrowBalance(req.params.walletId);
    res.json({ wallet_id: req.params.walletId, balances });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
