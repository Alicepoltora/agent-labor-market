const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const CIRCLE_BASE = 'https://api.circle.com/v1/w3s';

const http = axios.create({
  baseURL: CIRCLE_BASE,
  headers: {
    Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

/**
 * Create a fresh escrow wallet for a task using Circle Programmable Wallets
 */
async function createEscrowWallet() {
  if (!process.env.CIRCLE_API_KEY || process.env.CIRCLE_API_KEY === 'your_circle_api_key_here') {
    // Mock for development
    return mockWallet();
  }

  try {
    const res = await http.post('/developer/wallets', {
      idempotencyKey: uuidv4(),
      entitySecretCiphertext: process.env.CIRCLE_ENTITY_SECRET,
      walletSetId: process.env.CIRCLE_WALLET_SET_ID,
      blockchains: ['ETH-SEPOLIA'],
      count: 1,
      metadata: [{ name: 'task-escrow', refId: uuidv4() }],
    });

    const wallet = res.data.data.wallets[0];
    return {
      id: wallet.id,
      address: wallet.address,
      blockchain: wallet.blockchain,
    };
  } catch (err) {
    console.error('Circle createEscrowWallet error:', err.response?.data || err.message);
    return mockWallet(); // Fallback to mock
  }
}

/**
 * Transfer USDC from escrow to solver
 */
async function releaseEscrow({ escrowWalletId, toAddress, amount, currency = 'USDC' }) {
  if (!process.env.CIRCLE_API_KEY || process.env.CIRCLE_API_KEY === 'your_circle_api_key_here') {
    console.log(`[MOCK] Release escrow: ${amount} ${currency} → ${toAddress}`);
    return { id: `mock-tx-${uuidv4()}`, status: 'complete' };
  }

  try {
    const res = await http.post('/developer/transactions/transfer', {
      idempotencyKey: uuidv4(),
      entitySecretCiphertext: process.env.CIRCLE_ENTITY_SECRET,
      walletId: escrowWalletId,
      destinationAddress: toAddress,
      amounts: [amount.toString()],
      tokenId: await getUSDCTokenId(),
      feeLevel: 'MEDIUM',
    });

    return res.data.data;
  } catch (err) {
    console.error('Circle releaseEscrow error:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Refund escrow back to requester
 */
async function refundEscrow({ escrowWalletId, toAddress, amount }) {
  return releaseEscrow({ escrowWalletId, toAddress, amount });
}

/**
 * Check escrow balance
 */
async function getEscrowBalance(walletId) {
  if (!process.env.CIRCLE_API_KEY || process.env.CIRCLE_API_KEY === 'your_circle_api_key_here') {
    return [{ token: { symbol: 'USDC' }, amount: '0' }];
  }

  const res = await http.get(`/wallets/${walletId}/balances`);
  return res.data.data.tokenBalances;
}

/**
 * Get USDC token ID on current network
 */
async function getUSDCTokenId() {
  const res = await http.get('/tokens?blockchain=ETH-SEPOLIA&standard=ERC20');
  const usdc = res.data.data.tokens.find(t => t.symbol === 'USDC');
  return usdc?.id;
}

function mockWallet() {
  const addr = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return {
    id: `mock-wallet-${uuidv4()}`,
    address: addr,
    blockchain: 'ETH-SEPOLIA',
    _mock: true,
  };
}

module.exports = { createEscrowWallet, releaseEscrow, refundEscrow, getEscrowBalance };
