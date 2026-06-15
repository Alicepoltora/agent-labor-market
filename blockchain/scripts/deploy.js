const hre = require('hardhat');
const { ethers } = hre;
const USDC = '0x3600000000000000000000000000000000000000';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  const usdcAbi = ['function balanceOf(address) view returns (uint256)'];
  const usdc = new ethers.Contract(USDC, usdcAbi, deployer);
  const bal = await usdc.balanceOf(deployer.address).catch(() => 0n);
  console.log(`USDC balance: ${ethers.formatUnits(bal, 6)} USDC`);
  console.log('Deploying AgentLaborMarket...');
  const F = await ethers.getContractFactory('AgentLaborMarket');
  const c = await F.deploy(USDC, deployer.address);
  console.log(`Tx: ${c.deploymentTransaction().hash}`);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log(`\n=== DEPLOYED ===`);
  console.log(`CONTRACT_ADDRESS=${addr}`);
  console.log(`EXCHANGE_WALLET=${deployer.address}`);
  console.log(`Explorer: https://testnet.arcscan.app/address/${addr}`);
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
