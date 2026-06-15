/**
 * deploy-raw.js — Compile and deploy AgentLaborMarket without Hardhat
 *
 * Usage:
 *   node deploy-raw.js
 *
 * Requires: npm install solc ethers dotenv
 * Env vars (in ../backend/.env or process.env):
 *   EXCHANGE_PRIVATE_KEY=0x...
 */

'use strict';

require('dotenv').config({ path: '../backend/.env' });
const solc   = require('solc');
const ethers = require('ethers');
const fs     = require('fs');
const path   = require('path');

// ── Config ────────────────────────────────────────────────────────────────────

const PRIVATE_KEY = process.env.EXCHANGE_PRIVATE_KEY;
const RPC_URL     = process.env.ARC_RPC    || 'https://rpc.testnet.arc.network';
const CHAIN_ID    = parseInt(process.env.ARC_CHAIN_ID || '5042002', 10);
const USDC        = process.env.USDC_ADDRESS || '0x3600000000000000000000000000000000000000';

if (!PRIVATE_KEY) {
  console.error('❌  EXCHANGE_PRIVATE_KEY not set in backend/.env');
  process.exit(1);
}

// ── Read contract source ───────────────────────────────────────────────────────

const contractPath = path.join(__dirname, 'contracts', 'AgentLaborMarket.sol');
const source       = fs.readFileSync(contractPath, 'utf8');

// ── Compile ────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════');
console.log('  AgentLaborMarket — Raw Deploy (no Hardhat)');
console.log('═══════════════════════════════════════════════════════');
console.log('  Compiling with solc', solc.version(), '...');

const input = {
  language: 'Solidity',
  sources: { 'AgentLaborMarket.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object'],
      },
    },
    evmVersion: 'paris',
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

// Check for errors
const errors = (output.errors || []).filter(e => e.severity === 'error');
if (errors.length > 0) {
  console.error('❌  Compilation errors:');
  errors.forEach(e => console.error('  ', e.formattedMessage));
  process.exit(1);
}
const warnings = (output.errors || []).filter(e => e.severity === 'warning');
if (warnings.length > 0) {
  console.log(`  ⚠️  ${warnings.length} warning(s) — proceeding`);
}

const contract = output.contracts['AgentLaborMarket.sol']['AgentLaborMarket'];
const abi      = contract.abi;
const bytecode = '0x' + contract.evm.bytecode.object;

console.log(`  ✅ Compiled — bytecode size: ${(bytecode.length / 2).toFixed(0)} bytes`);

// ── Deploy ─────────────────────────────────────────────────────────────────────

async function deploy() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, {
    chainId: CHAIN_ID,
    name: 'arc-testnet',
  });
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log(`\n  Network:   ARC Testnet (chainId: ${CHAIN_ID})`);
  console.log(`  RPC:       ${RPC_URL}`);
  console.log(`  Deployer:  ${wallet.address}`);

  // Check native balance (USDC is native gas on ARC)
  const nativeBal = await provider.getBalance(wallet.address);
  console.log(`  Gas bal:   ${ethers.formatEther(nativeBal)} USDC (native/18-dec)`);

  // Check ERC-20 USDC balance
  try {
    const usdcAbi = ['function balanceOf(address) view returns (uint256)'];
    const usdcContract = new ethers.Contract(USDC, usdcAbi, provider);
    const erc20Bal = await usdcContract.balanceOf(wallet.address);
    console.log(`  USDC bal:  ${ethers.formatUnits(erc20Bal, 6)} USDC (ERC-20/6-dec)`);
  } catch (_) {
    console.log(`  USDC bal:  (could not query ERC-20)`);
  }

  if (nativeBal === 0n) {
    console.log('\n  ⚠️  No native balance for gas. Fund this address:');
    console.log(`     ${wallet.address}`);
    console.log('     Faucet: https://faucet.circle.com (select ARC Testnet)');
    process.exit(1);
  }

  console.log('\n  Deploying AgentLaborMarket...');
  console.log(`  USDC addr: ${USDC}`);
  console.log(`  Fee recip: ${wallet.address} (2% platform fee)`);

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const deployTx = await factory.deploy(USDC, wallet.address);

  console.log(`  Tx hash:   ${deployTx.deploymentTransaction().hash}`);
  console.log(`  Waiting for confirmation...`);

  await deployTx.waitForDeployment();
  const address = await deployTx.getAddress();

  console.log(`\n  ✅ AgentLaborMarket DEPLOYED!`);
  console.log(`  Contract:  ${address}`);
  console.log(`  Explorer:  https://testnet.arcscan.app/address/${address}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Write ABI artifact for reference
  const artifact = { address, abi, deployedAt: new Date().toISOString() };
  fs.writeFileSync(
    path.join(__dirname, 'AgentLaborMarket.artifact.json'),
    JSON.stringify(artifact, null, 2)
  );
  console.log('  Saved: AgentLaborMarket.artifact.json');

  console.log('\n  ─── Add to backend/.env: ───────────────────────────');
  console.log(`  CONTRACT_ADDRESS=${address}`);
  console.log(`  EXCHANGE_WALLET=${wallet.address}`);
  console.log(`  USDC_ADDRESS=${USDC}`);
  console.log(`  ARC_RPC=${RPC_URL}`);
  console.log(`  ARC_CHAIN_ID=${CHAIN_ID}`);
  console.log('  ─────────────────────────────────────────────────────\n');

  return address;
}

deploy().catch(err => {
  console.error('\n  ❌ Deploy failed:', err.message);
  if (err.code === 'INSUFFICIENT_FUNDS') {
    console.error('  → Fund the deployer wallet with testnet USDC at faucet.circle.com');
  }
  process.exit(1);
});
