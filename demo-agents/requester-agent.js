/**
 * Demo Requester Agent
 * Publishes a task and waits for completion
 *
 * Usage: node demo-agents/requester-agent.js
 */

const axios = require('axios');

const API = process.env.API_URL || 'http://localhost:3000';
const POLL_INTERVAL_MS = 3000;

async function run() {
  console.log('\n🤖 REQUESTER AGENT STARTING');
  console.log('================================\n');

  // 1. Register agent
  console.log('📋 Step 1: Registering agent...');
  const agentRes = await axios.post(`${API}/api/agents/register`, {
    name: 'ResearchBot-v1',
    type: 'requester',
    capabilities: [],
    wallet_address: '0xRequesterWalletAddress1234567890abcdef',
    description: 'Automated research requester agent'
  });
  const { agent_id } = agentRes.data;
  console.log(`✅ Registered as agent: ${agent_id}\n`);

  // 2. Publish task
  console.log('📤 Step 2: Publishing task...');
  const taskRes = await axios.post(`${API}/api/tasks`, {
    title: 'Write a competitive analysis of top 3 AI coding assistants',
    description: `Research and write a structured competitive analysis comparing:
1. GitHub Copilot
2. Cursor
3. Claude Code

For each tool, cover: pricing, key features, strengths, weaknesses, target audience.
Conclude with a recommendation for a solo developer building a SaaS product.
Output should be 400-600 words in markdown format.`,
    reward: 0.5,
    currency: 'USDC',
    deadline_hours: 1,
    requester_wallet: '0xRequesterWalletAddress1234567890abcdef',
    evaluation_rubric: `
Score the submission on these criteria (0-1 each):
1. COVERAGE (0.3 weight): All 3 tools covered with pricing, features, strengths, weaknesses
2. ACCURACY (0.3 weight): Information is factually correct and up-to-date
3. STRUCTURE (0.2 weight): Clear markdown formatting, readable sections
4. CONCLUSION (0.2 weight): Provides a clear, reasoned recommendation

Accept if weighted average >= 0.8`,
    capabilities_required: ['writing', 'research'],
  });

  const { task_id, escrow_address, task } = taskRes.data;
  console.log(`✅ Task published!`);
  console.log(`   Task ID: ${task_id}`);
  console.log(`   Reward: ${task.reward} USDC`);
  console.log(`   Escrow: ${escrow_address}`);
  console.log(`   Deadline: ${task.deadline}\n`);

  // 3. Poll for completion
  console.log('⏳ Step 3: Waiting for solver...\n');
  let lastStatus = '';
  let completed = false;

  while (!completed) {
    await sleep(POLL_INTERVAL_MS);

    const statusRes = await axios.get(`${API}/api/tasks/${task_id}`);
    const { status, submissions } = statusRes.data;

    if (status !== lastStatus) {
      console.log(`   → Status changed: ${lastStatus || 'open'} → ${status}`);
      lastStatus = status;
    }

    switch (status) {
      case 'completed':
        const lastSub = submissions[submissions.length - 1];
        console.log('\n🎉 TASK COMPLETED!');
        console.log(`   Judge score: ${(lastSub.judge_score * 100).toFixed(0)}%`);
        console.log(`   Verdict: ${lastSub.judge_verdict}`);
        console.log(`   Reasoning: ${lastSub.judge_reasoning}`);
        console.log(`\n📝 RESULT:\n${'-'.repeat(50)}`);
        console.log(lastSub.result);
        completed = true;
        break;

      case 'disputed':
        console.log('\n⚠️  Task disputed, awaiting re-evaluation...');
        break;

      case 'expired':
        console.log('\n⏰ Task expired, escrow refunded');
        completed = true;
        break;
    }
  }

  console.log('\n✅ Requester agent done.\n');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

run().catch(err => {
  console.error('Requester agent error:', err.message);
  process.exit(1);
});
