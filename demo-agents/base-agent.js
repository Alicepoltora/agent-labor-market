/**
 * BaseAgent — shared logic for all demo agents
 * Each specialized agent extends this with: name, capabilities, systemPrompt, walletAddress
 */
const axios = require('axios');
const OpenAI = require('openai');

const API = process.env.API_URL || 'http://localhost:4000';
const POLL_MS = 4000;

// Groq client (OpenAI-compatible)
const groq = process.env.GROQ_API_KEY
  ? new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    })
  : null;

// Global concurrency limiter for Groq solve() calls — shared across all agent instances
// Prevents hitting rate limits when 20 agents solve simultaneously
const MAX_SOLVE_CONCURRENT = 1;
let activeSolves = 0;
const solveQueue = [];

function solveWhenSlot(fn) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (activeSolves < MAX_SOLVE_CONCURRENT) {
        activeSolves++;
        fn().then(resolve).catch(reject).finally(() => {
          activeSolves--;
          if (solveQueue.length > 0) solveQueue.shift()();
        });
      } else {
        solveQueue.push(attempt);
      }
    };
    attempt();
  });
}

// ANSI color palette — each agent gets a unique color
const COLORS = [
  '\x1b[31m', '\x1b[32m', '\x1b[33m', '\x1b[34m', '\x1b[35m',
  '\x1b[36m', '\x1b[91m', '\x1b[92m', '\x1b[93m', '\x1b[94m',
  '\x1b[95m', '\x1b[96m', '\x1b[33m', '\x1b[35m', '\x1b[32m',
  '\x1b[34m', '\x1b[91m', '\x1b[93m', '\x1b[96m', '\x1b[31m',
];
const RESET = '\x1b[0m';

class BaseAgent {
  constructor({ name, emoji, capabilities, systemPrompt, walletAddress, colorIndex = 0 }) {
    this.name = name;
    this.emoji = emoji;
    this.capabilities = capabilities;
    this.systemPrompt = systemPrompt;
    this.walletAddress = walletAddress || `0xAgent${name.replace(/\W/g, '')}Wallet`;
    this.color = COLORS[colorIndex % COLORS.length];
    this.agentId = null;
    this.tasksDone = 0;
    this.totalEarned = 0;
  }

  log(msg) {
    const ts = new Date().toLocaleTimeString('ru-RU');
    console.log(`${this.color}[${ts}] ${this.emoji} ${this.name.padEnd(22)}${RESET} ${msg}`);
  }

  async register() {
    const res = await axios.post(`${API}/api/agents/register`, {
      name: this.name,
      type: 'solver',
      capabilities: this.capabilities,
      wallet_address: this.walletAddress,
      description: this.systemPrompt.slice(0, 100),
    });
    this.agentId = res.data.agent_id;
    this.log(`Зарегистрирован (id: ${this.agentId.slice(0, 8)}...)`);
  }

  async findTask() {
    const list = await this.findTaskList();
    return list[0] || null;
  }

  async findTaskList() {
    const caps = this.capabilities.join(',');
    const res = await axios.get(`${API}/api/tasks?status=open&capabilities=${caps}&limit=20`);
    return res.data.tasks.filter(t =>
      t.capabilities_required.length === 0 ||
      t.capabilities_required.some(c => this.capabilities.includes(c))
    );
  }

  async claimTask(task) {
    await axios.post(`${API}/api/tasks/${task.id}/claim`, {
      solver_wallet: this.walletAddress,
      solver_id: this.agentId,
      solver_capabilities: this.capabilities,
    });
  }

  async solve(task) {
    if (!groq) {
      return `[MOCK SOLUTION by ${this.name}] ${task.description.slice(0, 200)}`;
    }
    // Use global semaphore — max 3 agents solve simultaneously to avoid Groq rate limits
    return solveWhenSlot(async () => {
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          const res = await groq.chat.completions.create({
            model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
            messages: [
              { role: 'system', content: this.systemPrompt },
              { role: 'user', content: `TASK: ${task.title}\n\n${task.description}` },
            ],
            temperature: 0.7,
            max_tokens: 500,
          });
          // 4s pause to keep combined Groq RPM ≤ 30 (shared with judge)
          await sleep(4000);
          return res.choices[0].message.content;
        } catch (e) {
          const isRateLimit = e.status === 429 || (e.message || '').includes('rate');
          if (attempt < 4 && isRateLimit) {
            const wait = attempt * 8000 + Math.random() * 4000; // jitter: 8-12s, 16-20s, 24-28s
            this.log(`⏳ Rate limit, жду ${(wait / 1000).toFixed(0)}s (попытка ${attempt}/4)`);
            await sleep(wait);
          } else {
            throw e;
          }
        }
      }
    });
  }

  async submitResult(task, result) {
    const res = await axios.post(`${API}/api/tasks/${task.id}/submit`, {
      solver_id: this.agentId,
      result,
    });
    return res.data.submission_id;
  }

  async waitForVerdict(taskId, timeoutMs = 600000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await sleep(3000);
      const res = await axios.get(`${API}/api/judge/task/${taskId}`);
      const sub = res.data.submissions.find(s => s.solver_id === this.agentId);
      if (sub?.judge_verdict) return sub;
    }
    return null;
  }

  async run(loops = 1) {
    try {
      await this.register();
    } catch (e) {
      this.log(`❌ Ошибка регистрации: ${e.message}`);
      return;
    }

    for (let i = 0; i < loops; i++) {
      try {
        await this._runOnce();
      } catch (e) {
        this.log(`⚠️  Ошибка: ${e.response?.data?.error || e.message}`);
      }
      if (i < loops - 1) await sleep(POLL_MS);
    }

    this.log(`✅ Завершил. Выполнено: ${this.tasksDone} задач | Заработано: ${this.totalEarned.toFixed(4)} USDC`);
  }

  async _runOnce() {
    // Poll + claim loop — retry until we successfully claim a task
    this.log(`🔍 Ищу задачу...`);
    let task = null;
    let waitCount = 0;

    while (!task) {
      const candidates = await this.findTaskList();
      let claimed = false;

      for (const candidate of candidates) {
        try {
          await this.claimTask(candidate);
          task = candidate;
          claimed = true;
          break;
        } catch (e) {
          // Task was claimed by another agent — try next
        }
      }

      if (!claimed) {
        if (++waitCount % 3 === 0) this.log(`⏳ Жду доступную задачу... (${waitCount * POLL_MS / 1000}s)`);
        await sleep(POLL_MS);
      }
    }

    this.log(`🎯 Захватил: "${task.title.slice(0, 50)}..." [${task.reward} USDC]`);

    // Solve
    this.log(`🧠 Решаю...`);
    const result = await this.solve(task);
    this.log(`✍️  Решение готово (${result.length} символов)`);

    // Submit
    const subId = await this.submitResult(task, result);
    this.log(`📤 Отправлено (sub: ${subId.slice(0, 8)}...) — жду судью`);

    // Wait for verdict
    const verdict = await this.waitForVerdict(task.id);
    if (!verdict) {
      this.log(`⏰ Судья не ответил`);
      return;
    }

    const scoreStr = verdict.judge_score ? `${(verdict.judge_score * 100).toFixed(0)}%` : '?';
    if (verdict.judge_verdict === 'ACCEPT') {
      const earned = task.reward * 0.98;
      this.totalEarned += earned;
      this.tasksDone++;
      this.log(`💰 ACCEPT ${scoreStr} → +${earned.toFixed(4)} USDC (всего: ${this.totalEarned.toFixed(4)})`);
    } else {
      this.log(`❌ ${verdict.judge_verdict} ${scoreStr} — оплата не получена`);
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { BaseAgent, sleep };
