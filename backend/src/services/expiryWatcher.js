const cron = require('node-cron');
const taskStore = require('./taskStore');
const circleService = require('./circleService');

/**
 * Background job: expire overdue tasks and refund escrow
 */
function startExpiryWatcher() {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    const expired = taskStore.getExpired();
    if (expired.length === 0) return;

    console.log(`[ExpiryWatcher] Processing ${expired.length} expired task(s)`);

    for (const task of expired) {
      try {
        // Refund to requester
        const tx = await circleService.refundEscrow({
          escrowWalletId: task.escrow_wallet,
          toAddress: task.requester_wallet,
          amount: task.reward,
        });

        task.status = 'expired';
        task.refund_tx = tx.id;
        task.expired_at = new Date().toISOString();
        taskStore.set(task.id, task);

        console.log(`[ExpiryWatcher] ⏰ Task ${task.id} expired, refunded ${task.reward} USDC`);
      } catch (err) {
        console.error(`[ExpiryWatcher] Failed to expire task ${task.id}:`, err.message);
      }
    }
  });

  console.log('[ExpiryWatcher] Started — checking every 5 minutes');
}

module.exports = { startExpiryWatcher };
