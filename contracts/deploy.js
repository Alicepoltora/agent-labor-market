/**
 * Deploy AgentEscrow to Sepolia testnet
 * Usage: node contracts/deploy.js
 */

require('dotenv').config({ path: './backend/.env' });
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Sepolia USDC address
const SEPOLIA_USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

async function main() {
  const rpc = process.env.RPC_URL;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

  if (!rpc || !privateKey) {
    console.error('Set RPC_URL and DEPLOYER_PRIVATE_KEY in backend/.env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpc);
  const deployer = new ethers.Wallet(privateKey, provider);

  console.log(`Deploying from: ${deployer.address}`);
  console.log(`Network: ${(await provider.getNetwork()).name}`);

  // Read compiled ABI and bytecode (compile with solc or hardhat first)
  // For now, log the deployment command
  console.log('\n⚠️  Compile contract first with Hardhat:');
  console.log('  npx hardhat compile');
  console.log('  npx hardhat run contracts/deploy.js --network sepolia');
  console.log('\nOr use Remix IDE to deploy AgentEscrow.sol with constructor args:');
  console.log(`  _usdc: ${SEPOLIA_USDC}`);
  console.log(`  _oracle: ${deployer.address}  (your backend wallet)`);
  console.log(`  _platformFeeBps: 200  (2%)`);
  console.log(`  _feeRecipient: ${deployer.address}`);
}

main().catch(console.error);
