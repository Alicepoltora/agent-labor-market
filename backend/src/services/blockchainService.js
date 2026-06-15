/**
 * blockchainService.js — On-chain integration with AgentLaborMarket on ARC Testnet
 *
 * Responsibilities:
 *  - postTaskOnChain()     : Mirror backend task → on-chain escrow
 *  - completeTaskOnChain() : Judge approved → call contract.completeTask()
 *  - rejectTaskOnChain()   : Judge rejected → call contract.rejectTask()
 *  - getAgentStats()       : Read on-chain agent earnings
 *
 * ARC Testnet:
 *  Chain ID: 5042002
 *  RPC:      https://rpc.testnet.arc.network
 *  USDC:     0x3600000000000000000000000000000000000000 (6 decimals)
 *  Explorer: https://testnet.arcscan.app
 */

const { ethers } = require('ethers');

// ── Config ────────────────────────────────────────────────────────────────────

const ARC_RPC     = process.env.ARC_RPC     || 'https://rpc.testnet.arc.network';
const ARC_CHAINID = parseInt(process.env.ARC_CHAIN_ID || '5042002', 10);
const USDC_ADDR   = process.env.USDC_ADDRESS || '0x3600000000000000000000000000000000000000';
const CONTRACT    = process.env.CONTRACT_ADDRESS;   // AgentLaborMarket address
const EXCHANGE_PK = process.env.EXCHANGE_PRIVATE_KEY; // Key #0 (platform/deployer)

// ── ABIs ──────────────────────────────────────────────────────────────────────

const ALM_ABI = [
  'function postTask(string,string,string,uint256,uint256,string,address) returns (uint256)',
  'function claimTask(uint256)',
  'function submitDeliverable(uint256,bytes32)',
  'function completeTask(uint256,bytes32)',
  'function rejectTask(uint256,bytes32)',
  'function expireTask(uint256)',
  'function getTask(uint256) view returns (tuple(uint256 id,address client,address solver,address evaluator,string title,string description,string capabilities,uint256 reward,uint256 expiresAt,uint8 status,bytes32 deliverableHash,string apiTaskId))',
  'function getAgentStats(address) view returns (uint256 totalEarned, uint256 tasksDone)',
  'function totalTasksPosted() view returns (uint256)',
  'event TaskPosted(uint256 indexed taskId, address indexed client, uint256 reward, string apiTaskId, string title)',
  'event TaskCompleted(uint256 indexed taskId, address indexed solver, uint256 payout, uint256 fee)',
  'event TaskRejected(uint256 indexed taskId, address indexed solver, bytes32 reason)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

// ── Singleton provider/signer ─────────────────────────────────────────────────

let _provider = null;
let _signer   = null;
let _contract = null;
let _usdc     = null;
let _enabled  = false;

function init() {
  if (!CONTRACT || !EXCHANGE_PK) {
    console.log('[blockchain] ⚠️  CONTRACT_ADDRESS or EXCHANGE_PRIVATE_KEY not set — blockchain integration disabled');
    return false;
  }

  try {
    _provider = new ethers.JsonRpcProvider(ARC_RPC, {
      chainId: ARC_CHAINID,
      name:    'arc-testnet',
    });
    _signer   = new ethers.Wallet(EXCHANGE_PK, _provider);
    _contract = new ethers.Contract(CONTRACT, ALM_ABI, _signer);
    _usdc     = new ethers.Contract(USDC_ADDR, ERC20_ABI, _signer);
    _enabled  = true;

    console.log(`[blockchain] ✅ Connected to ARC Testnet`);
    console.log(`[blockchain]    Contract: ${CONTRACT}`);
    console.log(`[blockchain]    Signer:   ${_signer.address}`);
    return true;
  } catch (e) {
    console.error('[blockchain] ❌ Init failed:', e.message);
    return false;
  }
}

// Auto-init on module load
init();

// ── Helpers ───────────────────────────────────────────────────────────────────

function isEnabled() { return _enabled; }

function toUSDC6(amountDecimal) {
  // Convert decimal USDC (e.g. 0.04) to 6-decimal integer (e.g. 40000)
  return BigInt(Math.round(amountDecimal * 1_000_000));
}

async function ensureApproval(amountWei) {
  const allowance = await _usdc.allowance(_signer.address, CONTRACT);
  if (allowance < amountWei) {
    console.log(`[blockchain] Approving USDC allowance...`);
    const tx = await _usdc.approve(CONTRACT, amountWei * 100n); // approve 100x to avoid repeated approvals
    await tx.wait();
    console.log(`[blockchain] USDC approved: ${tx.hash}`);
  }
}

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Mirror a backend task on-chain with USDC escrow.
 * The exchange wallet pays the USDC reward into escrow.
 *
 * @param {object} task - Backend task object
 * @param {string} solverAddress - On-chain address of the assigned solver
 * @returns {object} { onChainTaskId, txHash } or null if disabled
 */
async function postTaskOnChain(task, solverAddress) {
  if (!isEnabled()) return null;

  try {
    const rewardWei = toUSDC6(task.reward);
    const durationSec = BigInt(Math.floor((new Date(task.deadline || Date.now() + 3600_000) - Date.now()) / 1000));
    const safeDuration = durationSec > 0n ? durationSec : 3600n; // min 1 hour

    // Ensure exchange wallet has approved USDC
    await ensureApproval(rewardWei);

    console.log(`[blockchain] Posting task on-chain: "${task.title}" (${task.reward} USDC)`);
    const tx = await _contract.postTask(
      task.title.slice(0, 100),
      task.description.slice(0, 500),
      (task.capabilities_required || []).join(','),
      rewardWei,
      safeDuration,
      task.id,           // apiTaskId (backend UUID)
      solverAddress || ethers.ZeroAddress, // evaluator = owner if zero
    );

    const receipt = await tx.wait();
    console.log(`[blockchain] ✅ Task posted: txHash=${receipt.hash}`);

    // Extract on-chain taskId from event
    let onChainTaskId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = _contract.interface.parseLog(log);
        if (parsed?.name === 'TaskPosted') {
          onChainTaskId = parsed.args.taskId.toString();
          break;
        }
      } catch { /* skip */ }
    }

    return {
      onChainTaskId,
      txHash: receipt.hash,
      explorerUrl: `https://testnet.arcscan.app/tx/${receipt.hash}`,
    };
  } catch (e) {
    console.error('[blockchain] postTaskOnChain error:', e.message);
    return null;
  }
}

/**
 * Called after LLM judge accepts a submission.
 * Releases USDC from escrow to the solver's on-chain wallet.
 *
 * @param {string} onChainTaskId - On-chain task ID (from postTaskOnChain)
 * @param {string} reason - Human-readable approval reason
 * @returns {object} { txHash, payout } or null
 */
async function completeTaskOnChain(onChainTaskId, reason = 'deliverable-approved') {
  if (!isEnabled() || !onChainTaskId) return null;

  try {
    const reasonHash = ethers.keccak256(ethers.toUtf8Bytes(reason));
    console.log(`[blockchain] Completing on-chain task #${onChainTaskId}...`);

    const tx = await _contract.completeTask(BigInt(onChainTaskId), reasonHash);
    const receipt = await tx.wait();

    let payout = null;
    for (const log of receipt.logs) {
      try {
        const parsed = _contract.interface.parseLog(log);
        if (parsed?.name === 'TaskCompleted') {
          payout = ethers.formatUnits(parsed.args.payout, 6);
          break;
        }
      } catch { /* skip */ }
    }

    console.log(`[blockchain] ✅ Task #${onChainTaskId} completed — payout: ${payout} USDC`);
    console.log(`[blockchain]    Tx: https://testnet.arcscan.app/tx/${receipt.hash}`);

    return {
      txHash:      receipt.hash,
      payout,
      explorerUrl: `https://testnet.arcscan.app/tx/${receipt.hash}`,
    };
  } catch (e) {
    console.error(`[blockchain] completeTaskOnChain #${onChainTaskId} error:`, e.message);
    return null;
  }
}

/**
 * Called after LLM judge rejects a submission.
 * Refunds USDC escrow to the client.
 *
 * @param {string} onChainTaskId - On-chain task ID
 * @param {string} reason - Rejection reason
 * @returns {object} { txHash } or null
 */
async function rejectTaskOnChain(onChainTaskId, reason = 'deliverable-rejected') {
  if (!isEnabled() || !onChainTaskId) return null;

  try {
    const reasonHash = ethers.keccak256(ethers.toUtf8Bytes(reason));
    console.log(`[blockchain] Rejecting on-chain task #${onChainTaskId}...`);

    const tx = await _contract.rejectTask(BigInt(onChainTaskId), reasonHash);
    const receipt = await tx.wait();

    console.log(`[blockchain] ✅ Task #${onChainTaskId} rejected (refunded)`);
    console.log(`[blockchain]    Tx: https://testnet.arcscan.app/tx/${receipt.hash}`);

    return {
      txHash:      receipt.hash,
      explorerUrl: `https://testnet.arcscan.app/tx/${receipt.hash}`,
    };
  } catch (e) {
    console.error(`[blockchain] rejectTaskOnChain #${onChainTaskId} error:`, e.message);
    return null;
  }
}

/**
 * Read on-chain agent stats.
 * @param {string} agentAddress - Agent's Ethereum address
 */
async function getAgentOnChainStats(agentAddress) {
  if (!isEnabled()) return null;

  try {
    const [earned, done] = await _contract.getAgentStats(agentAddress);
    return {
      totalEarnedUSDC: ethers.formatUnits(earned, 6),
      tasksDone:       done.toString(),
    };
  } catch (e) {
    return null;
  }
}

/**
 * Get total tasks posted on-chain.
 */
async function getTotalOnChainTasks() {
  if (!isEnabled()) return 0;
  try {
    return Number(await _contract.totalTasksPosted());
  } catch { return 0; }
}

/**
 * Get USDC balance of an address (6 decimals).
 */
async function getUSDCBalance(address) {
  if (!isEnabled()) return '0';
  try {
    const bal = await _usdc.balanceOf(address);
    return ethers.formatUnits(bal, 6);
  } catch { return '0'; }
}

/**
 * Direct USDC transfer from exchange wallet to solver's on-chain address.
 * Used when judge ACCEPTs a task — pays the solver on-chain.
 *
 * @param {string} toAddress   - Solver's on-chain wallet address
 * @param {number} amountUsdc  - Amount in decimal USDC (e.g. 0.039 for 0.04 minus 2% fee)
 * @returns {object|null}      - { txHash, explorerUrl } or null on failure
 */
async function payAgentDirectly(toAddress, amountUsdc) {
  if (!isEnabled()) return null;
  if (!toAddress || toAddress.startsWith('0xAgent')) {
    // Placeholder wallet — agent doesn't have a real on-chain address yet
    console.log(`[blockchain] ⚠️  Skipping on-chain pay — ${toAddress} is a placeholder`);
    return null;
  }

  try {
    const amountWei = toUSDC6(amountUsdc);
    if (amountWei === 0n) return null;

    console.log(`[blockchain] 💸 Paying ${amountUsdc} USDC on-chain → ${toAddress}`);
    const tx = await _usdc.transfer(toAddress, amountWei);
    const receipt = await tx.wait();

    console.log(`[blockchain] ✅ On-chain payment confirmed: ${receipt.hash}`);
    console.log(`[blockchain]    Explorer: https://testnet.arcscan.app/tx/${receipt.hash}`);

    return {
      txHash:      receipt.hash,
      explorerUrl: `https://testnet.arcscan.app/tx/${receipt.hash}`,
      amount:      amountUsdc,
      to:          toAddress,
    };
  } catch (e) {
    console.error('[blockchain] payAgentDirectly error:', e.message);
    return null;
  }
}

module.exports = {
  isEnabled,
  postTaskOnChain,
  completeTaskOnChain,
  rejectTaskOnChain,
  payAgentDirectly,
  getAgentOnChainStats,
  getTotalOnChainTasks,
  getUSDCBalance,
  CONTRACT_ADDRESS: CONTRACT,
  EXCHANGE_ADDRESS: EXCHANGE_PK ? new ethers.Wallet(EXCHANGE_PK).address : null,
};
