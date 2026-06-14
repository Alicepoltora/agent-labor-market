const OpenAI = require('openai');
const taskStore = require('./taskStore');
const circleService = require('./circleService');

// Groq is OpenAI-compatible — same SDK, different baseURL + key
let openai;
try {
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
    openai = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    console.log('[Judge] Using Groq API');
  }
} catch (e) {
  console.warn('[Judge] Groq not configured, will use mock evaluation');
}

const AUTO_THRESHOLD = parseFloat(process.env.JUDGE_AUTO_THRESHOLD || '0.5');

// Simple concurrency limiter — max 3 Groq calls at once
let activeJudgements = 0;
const MAX_CONCURRENT = 1;
const judgeQueue = [];

function runWhenSlot(fn) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (activeJudgements < MAX_CONCURRENT) {
        activeJudgements++;
        fn().then(resolve).catch(reject).finally(() => {
          activeJudgements--;
          if (judgeQueue.length > 0) judgeQueue.shift()();
        });
      } else {
        judgeQueue.push(attempt);
      }
    };
    attempt();
  });
}

/**
 * Core evaluation function — called async after submission
 */
async function evaluate(taskId, submissionId, extraContext = {}) {
  const task = taskStore.get(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const submission = task.submissions.find(s => s.id === submissionId);
  if (!submission) throw new Error(`Submission ${submissionId} not found`);

  console.log(`[Judge] Evaluating submission ${submissionId} for task ${taskId}`);

  let score, reasoning, verdict;

  const doEval = async () => {
  if (!openai) {
    // Mock evaluation for dev
    ({ score, reasoning, verdict } = mockEvaluate());
  } else {
    ({ score, reasoning, verdict } = await llmEvaluate(task, submission, extraContext));
  }
  };
  await runWhenSlot(doEval);

  // Update submission with judge result
  submission.judge_score = score;
  submission.judge_reasoning = reasoning;
  submission.judge_verdict = verdict;
  submission.evaluated_at = new Date().toISOString();

  if (score >= AUTO_THRESHOLD && verdict === 'ACCEPT') {
    // Auto-release escrow to solver
    await handleAccept(task, submission);
  } else if (verdict === 'REJECT' || score < 0.3) {
    await handleReject(task, submission);
  } else {
    // Borderline — flag for manual review (or re-evaluate)
    task.status = 'disputed';
    task.judge_flag = { score, reasoning, flagged_at: new Date().toISOString() };
  }

  taskStore.set(taskId, task);
  console.log(`[Judge] Task ${taskId}: score=${score.toFixed(2)} verdict=${verdict}`);

  return { score, reasoning, verdict };
}

/**
 * LLM evaluation via GPT-4o mini
 */
async function llmEvaluate(task, submission, extraContext = {}) {
  const prompt = buildJudgePrompt(task, submission, extraContext);

  // Retry up to 3 times on rate-limit
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await openai.chat.completions.create({
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `You are a fair, objective judge for an AI agent task marketplace.
Your job is to evaluate whether a submitted result satisfactorily completes a given task.
You must return a JSON object with exactly these fields:
{
  "score": <float 0.0-1.0>,
  "verdict": "ACCEPT" | "REJECT" | "PARTIAL",
  "reasoning": "<detailed explanation>"
}`
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 250,
      }, { timeout: 25000 });

      const parsed = JSON.parse(res.choices[0].message.content);
      await new Promise(r => setTimeout(r, 2000)); // 2s pace for RPM
      return {
        score: parseFloat(parsed.score),
        reasoning: parsed.reasoning,
        verdict: parsed.verdict || 'ACCEPT',
        rubric_scores: {},
      };
    } catch (e) {
      const isRate = e.status === 429 || (e.message || '').includes('rate');
      if (attempt < 3 && isRate) {
        const wait = attempt * 10000;
        console.log(`[Judge] Rate limit, waiting ${wait/1000}s (attempt ${attempt}/3)`);
        await new Promise(r => setTimeout(r, wait));
      } else {
        throw e;
      }
    }
  }
}

function buildJudgePrompt(task, submission, extraContext) {
  return `
## TASK DESCRIPTION
**Title:** ${task.title}
**Description:** ${task.description}

## EVALUATION RUBRIC
${task.evaluation_rubric}

## SUBMITTED RESULT
${submission.result}
${submission.result_url ? `**Result URL:** ${submission.result_url}` : ''}
${submission.proof_hash ? `**Proof Hash:** ${submission.proof_hash}` : ''}

${extraContext.dispute_reason ? `## DISPUTE REASON FROM REQUESTER\n${extraContext.dispute_reason}` : ''}

## YOUR TASK
Evaluate whether the submission satisfactorily completes the task according to the rubric.
Be strict but fair. Give partial credit where appropriate.
Return JSON as instructed.
`.trim();
}

async function handleAccept(task, submission) {
  const solver = task.solvers.find(s => s.solver_id === submission.solver_id) || task.solvers[0];
  if (!solver) return;

  const netReward = task.reward - task.platform_fee;

  try {
    const tx = await circleService.releaseEscrow({
      escrowWalletId: task.escrow_wallet,
      toAddress: solver.solver_wallet,
      amount: netReward,
    });

    task.status = 'completed';
    task.completed_at = new Date().toISOString();
    task.payout_tx = tx.id;
    console.log(`[Judge] ✅ Released ${netReward} USDC to ${solver.solver_wallet}, tx: ${tx.id}`);
  } catch (err) {
    console.error('[Judge] Release failed:', err.message);
    task.status = 'disputed';
    task.payout_error = err.message;
  }
}

async function handleReject(task, submission) {
  try {
    const tx = await circleService.refundEscrow({
      escrowWalletId: task.escrow_wallet,
      toAddress: task.requester_wallet,
      amount: task.reward,
    });

    task.status = 'expired';
    task.refund_tx = tx.id;
    console.log(`[Judge] ❌ Refunded ${task.reward} USDC to ${task.requester_wallet}`);
  } catch (err) {
    console.error('[Judge] Refund failed:', err.message);
    task.status = 'disputed';
  }
}

function mockEvaluate() {
  const score = 0.85 + Math.random() * 0.15; // High score in mock
  return {
    score,
    reasoning: `[MOCK] Task evaluated with score ${score.toFixed(2)}. The submission adequately addresses the task requirements.`,
    verdict: 'ACCEPT',
  };
}

module.exports = { evaluate };
