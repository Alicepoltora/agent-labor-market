/**
 * Demo Solver Agent
 * Listens for open tasks, claims one, generates result with GPT, submits
 *
 * Usage: node demo-agents/solver-agent.js
 */

const axios = require('axios');
const OpenAI = require('openai');

const API = process.env.API_URL || 'http://localhost:3000';
const POLL_INTERVAL_MS = 5000;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const SOLVER_ID = `solver-${Date.now()}`;
const SOLVER_WALLET = '0xSolverWalletAddress1234567890abcdef1234';

async function run() {
  console.log('\n🤖 SOLVER AGENT STARTING');
  console.log('================================\n');

  // 1. Register
  console.log('📋 Step 1: Registering solver agent...');
  const agentRes = await axios.post(`${API}/api/agents/register`, {
    name: 'GPT4oSolver-v1',
    type: 'solver',
    capabilities: ['writing', 'research', 'analysis', 'coding'],
    wallet_address: SOLVER_WALLET,
    description: 'GPT-4o powered solver agent for writing and research tasks'
  });
  console.log(`✅ Registered: ${agentRes.data.agent_id}\n`);

  // 2. Poll for tasks
  console.log('🔍 Step 2: Looking for tasks...\n');
  let claimed = false;
  let targetTask = null;

  while (!claimed) {
    await sleep(POLL_INTERVAL_MS);

    const { data } = await axios.get(`${API}/api/tasks?status=open&capabilities=writing,research&limit=5`);

    if (data.tasks.length === 0) {
      process.stdout.write('.');
      continue;
    }

    // Pick highest-reward task
    const task = data.tasks[0];
    console.log(`\n🎯 Found task: "${task.title}"`);
    console.log(`   Reward: ${task.reward} USDC | Deadline: ${task.deadline}`);

    // Claim it
    try {
      await axios.post(`${API}/api/tasks/${task.id}/claim`, {
        solver_wallet: SOLVER_WALLET,
        solver_id: SOLVER_ID,
        solver_capabilities: ['writing', 'research'],
        estimated_completion_minutes: 2,
      });
      console.log(`✅ Claimed task ${task.id}\n`);
      claimed = true;
      targetTask = task;
    } catch (err) {
      console.log(`   Could not claim: ${err.response?.data?.error || err.message}`);
    }
  }

  // 3. Solve
  console.log('🧠 Step 3: Solving task with GPT...');
  const result = await solveTask(targetTask);
  console.log(`✅ Solution generated (${result.length} chars)\n`);

  // 4. Submit
  console.log('📤 Step 4: Submitting result...');
  const submitRes = await axios.post(`${API}/api/tasks/${targetTask.id}/submit`, {
    solver_id: SOLVER_ID,
    result,
    proof_hash: hashResult(result),
  });

  console.log(`✅ Submitted! Submission ID: ${submitRes.data.submission_id}`);
  console.log('   LLM Judge is evaluating...\n');

  // 5. Wait for verdict
  console.log('⏳ Step 5: Waiting for judge verdict...');
  let done = false;
  while (!done) {
    await sleep(3000);
    const judgeRes = await axios.get(`${API}/api/judge/task/${targetTask.id}`);
    const subs = judgeRes.data.submissions;
    const mySub = subs.find(s => s.solver_id === SOLVER_ID);

    if (mySub?.judge_verdict) {
      console.log(`\n🏛️  JUDGE VERDICT: ${mySub.judge_verdict}`);
      console.log(`   Score: ${(mySub.judge_score * 100).toFixed(0)}%`);
      console.log(`   Reasoning: ${mySub.judge_reasoning}`);

      if (mySub.judge_verdict === 'ACCEPT') {
        const net = (targetTask.reward * 0.98).toFixed(4);
        console.log(`\n💰 PAYMENT: ${net} USDC → ${SOLVER_WALLET}`);
      } else {
        console.log('\n❌ Result rejected, no payment');
      }

      done = true;
    }
  }

  console.log('\n✅ Solver agent done.\n');
}

async function solveTask(task) {
  if (!openai) {
    // Mock solution for dev
    return `# Competitive Analysis: Top 3 AI Coding Assistants

## 1. GitHub Copilot
**Pricing:** $10/month individual, $19/month business
**Key Features:** Inline code completion, chat interface, multi-language support
**Strengths:** Deep GitHub integration, huge training corpus, enterprise security
**Weaknesses:** Sometimes generates hallucinated APIs, limited context window
**Target:** Enterprise teams already on GitHub

## 2. Cursor
**Pricing:** Free tier, $20/month Pro
**Key Features:** Full codebase context (Ctrl+K), multi-file edits, agent mode
**Strengths:** Best UX for AI-native coding, fast context injection, fork of VS Code
**Weaknesses:** Less IDE ecosystem than VS Code proper, newer product
**Target:** Individual devs and small teams who want maximum AI leverage

## 3. Claude Code
**Pricing:** Billed through Anthropic API usage
**Key Features:** Agentic coding in terminal, long context, web search
**Strengths:** Best at complex multi-step tasks, excellent reasoning
**Weaknesses:** Terminal-only UX, no inline completion
**Target:** Power users comfortable with CLI workflows

## Recommendation

For a solo developer building a SaaS: **Cursor**. It combines the familiar VS Code UX with the most aggressive AI integration — full codebase context means it can refactor across files and understand your entire project. Start on the free tier, upgrade to Pro ($20/month) when you hit the usage limits. Supplement with Claude Code via API for heavy architectural tasks.`;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an expert technical researcher. Provide thorough, accurate, well-structured responses in markdown.'
      },
      {
        role: 'user',
        content: `Complete this task:\n\n${task.title}\n\n${task.description}`
      }
    ],
    temperature: 0.7,
    max_tokens: 1000,
  });

  return completion.choices[0].message.content;
}

function hashResult(result) {
  // Simple hash for demo — use crypto in prod
  let hash = 0;
  for (let i = 0; i < result.length; i++) {
    hash = ((hash << 5) - hash) + result.charCodeAt(i);
    hash |= 0;
  }
  return '0x' + Math.abs(hash).toString(16).padStart(64, '0');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

run().catch(err => {
  console.error('Solver agent error:', err.message);
  process.exit(1);
});
