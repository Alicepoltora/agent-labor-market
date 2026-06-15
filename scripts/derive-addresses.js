/**
 * derive-addresses.js — Compute Ethereum addresses from private keys
 *
 * Usage: node scripts/derive-addresses.js
 *
 * Derives wallet addresses for:
 *  - Key 0 (index 0): Exchange/platform deployer wallet
 *  - Keys 1-19 (index 1-19): 20 AI agent wallets
 *
 * Output: agent-wallets.json + prints env vars for backend/.env
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ── Private keys (in order) ────────────────────────────────────────────────
// Index 0 = Exchange deployer
// Index 1-19 = Agents 01-19 (Agent 20 shares index 19)
const PRIVATE_KEYS = [
  '0x8d301936096c1bdd9110f0ce3e5b839f6f637ca53fe1f0d2351d2e5154e916b4', // Exchange
  '0x0bf4de5eb2bb44bc8394e6679ab5957ee1b2d3315abf9b296972b3648209ddd9', // Agent 01 BlogWriter
  '0x9b5b04676f4208968ef64dfad364f90ef2529691ca33d5bb7bce028532926e1d', // Agent 02 CodeReviewer
  '0xe9eda291fe3776c0271931be8c4225b3a113e39cda7781a66902d66a98fca4f9', // Agent 03 Translator
  '0xde0f4b2e4f9ff7d382c5c5f93fc7d31a282ca31a54c91bee2d952409bee6a534', // Agent 04 SEOAnalyzer
  '0xa4dc186079792c1eb3b4a7a944cbd25440bfb76e00942caef0333c9de88da85a', // Agent 05 DataExtractor
  '0xa4edfac02282128ef3146c2478cdf3968648b7b9fecd989a3354f2000e4a6d61', // Agent 06 Summarizer
  '0x46b7551f507ea38d27ff72ef4799740daf2e62ef5cb0839d021505e19dacf3c7', // Agent 07 TweetGenerator
  '0xff25aaa45558f641a543f27fe9763efb538d7b71a9b476f9b5d351447d6b1d5f', // Agent 08 EmailWriter
  '0x7eb8b4e154345445e19d4a5472d80fd913c5d53ec45dbd170112b83b1c1910f2', // Agent 09 ProductDescriber
  '0xb66b9e6e96fde2e1e858786d04bc21b1b0606bf7775c0ee46fd116d6d1347f85', // Agent 10 FactChecker
  '0x7646ba15ae0528d3905bad3725c3e1400a6105470f0e6df2c1f1d6bfcf97fe5b', // Agent 11 StoryWriter
  '0xf7cdd19183d594f3c2f8fb6d30486d982b841ab05dbf7c3e31879605e1092c9e', // Agent 12 MarketResearcher
  '0xffe8df7288d96dffaed63ab7459f0d8cf8a5fff8f6ed232b8fb5f59ce4f504fc', // Agent 13 BugFinder
  '0x6a0e614f9fd1488eb1b3c3247744c706667f985b9cd008e23fb2a7ac61e673b4', // Agent 14 RecipeCreator
  '0xb70e6a8759cf4454eb768d14a7d7231e07d3d0a2abda408e5484b14d5b238ccf', // Agent 15 ResumeReviewer
  '0x81b98abbf665fac2fbfdb15c2350d265f47ad6244b666a4fa6c32548cb00a246', // Agent 16 MathSolver
  '0x7c216da9fd979fe3b9d781f4d12b54bd58517b290c4544e2517ab5d1db59d140', // Agent 17 SentimentAnalyzer
  '0xa5d4a5eff1e714c18ab1bd53866022c723abe98bc2003d810e06b4b093275612', // Agent 18 SocialStrategist
  '0x24f631c728afcc9ea644175ce97afe4d784dd3e73ca675a79efbf4220f4f6678', // Agent 19 LegalSummarizer
  // Agent 20 (NewsDigest) reuses exchange wallet for on-chain identity
];

const AGENT_NAMES = [
  'Exchange (Platform)',
  'BlogWriter',
  'CodeReviewer',
  'Translator',
  'SEOAnalyzer',
  'DataExtractor',
  'Summarizer',
  'TweetGenerator',
  'EmailWriter',
  'ProductDescriber',
  'FactChecker',
  'StoryWriter',
  'MarketResearcher',
  'BugFinder',
  'RecipeCreator',
  'ResumeReviewer',
  'MathSolver',
  'SentimentAnalyzer',
  'SocialStrategist',
  'LegalSummarizer',
];

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log('  Agent Wallet Addresses (ARC Testnet / EVM)');
console.log('═══════════════════════════════════════════════════════════════════');

const wallets = [];

for (let i = 0; i < PRIVATE_KEYS.length; i++) {
  const wallet = new ethers.Wallet(PRIVATE_KEYS[i]);
  const label = AGENT_NAMES[i] || `Agent ${i}`;
  wallets.push({
    index:      i,
    name:       label,
    address:    wallet.address,
    privateKey: PRIVATE_KEYS[i],
  });
  const role = i === 0 ? ' [EXCHANGE / DEPLOYER]' : ` [Agent ${String(i).padStart(2, '0')}]`;
  console.log(`  ${role.padEnd(24)} ${label.padEnd(20)} ${wallet.address}`);
}

// Agent 20 (NewsDigest) uses exchange address
const newsDigest = new ethers.Wallet(PRIVATE_KEYS[0]);
wallets.push({
  index:      20,
  name:       'NewsDigest',
  address:    newsDigest.address,
  privateKey: PRIVATE_KEYS[0],
  note:       'shares exchange wallet',
});
console.log(`  ${'[Agent 20]'.padEnd(24)} ${'NewsDigest'.padEnd(20)} ${newsDigest.address} (shares exchange)`);

console.log('═══════════════════════════════════════════════════════════════════\n');

// Write wallets.json
const outPath = path.join(__dirname, '../agent-wallets.json');
fs.writeFileSync(outPath, JSON.stringify(wallets, null, 2));
console.log(`  ✅ Saved to agent-wallets.json\n`);

// Print env vars
console.log('  Add to backend/.env:');
console.log(`  EXCHANGE_PRIVATE_KEY=${PRIVATE_KEYS[0]}`);
console.log(`  EXCHANGE_WALLET=${new ethers.Wallet(PRIVATE_KEYS[0]).address}`);
console.log(`  USDC_ADDRESS=0x3600000000000000000000000000000000000000`);
console.log(`  ARC_RPC=https://rpc.testnet.arc.network`);
console.log(`  ARC_CHAIN_ID=5042002`);
console.log('  CONTRACT_ADDRESS=<deployed address>\n');
