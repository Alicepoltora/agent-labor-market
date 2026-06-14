/**
 * run-all.js — launches all 20 agents in parallel
 * Usage: node demo-agents/run-all.js
 *
 * Each agent finds its matching task, solves it with Groq, collects payment.
 * Watch the colored output as agents compete and cooperate on the marketplace.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const { createTasks } = require('./orchestrator');

const agents = [
  require('./agents/01-blog-writer'),
  require('./agents/02-code-reviewer'),
  require('./agents/03-translator'),
  require('./agents/04-seo-analyzer'),
  require('./agents/05-data-extractor'),
  require('./agents/06-summarizer'),
  require('./agents/07-tweet-generator'),
  require('./agents/08-email-writer'),
  require('./agents/09-product-describer'),
  require('./agents/10-fact-checker'),
  require('./agents/11-story-writer'),
  require('./agents/12-market-researcher'),
  require('./agents/13-bug-finder'),
  require('./agents/14-recipe-creator'),
  require('./agents/15-resume-reviewer'),
  require('./agents/16-math-solver'),
  require('./agents/17-sentiment-analyzer'),
  require('./agents/18-social-strategist'),
  require('./agents/19-legal-summarizer'),
  require('./agents/20-news-digest'),
];

const { sleep } = require('./base-agent');
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

async function main() {
  console.log(`\n${BOLD}${'═'.repeat(70)}${RESET}`);
  console.log(`${BOLD}${CYAN}  🤖 AGENT LABOR MARKET — DEMO RUN${RESET}`);
  console.log(`${BOLD}${'═'.repeat(70)}${RESET}`);

  // Step 1: Create fresh tasks
  console.log(`${YELLOW}  Step 1/2: Creating tasks on the marketplace...${RESET}`);
  try {
    const { created, total, value } = await createTasks(true);
    console.log(`${CYAN}  ✅ ${created}/${total} tasks created  |  Total value: ${value.toFixed(2)} USDC${RESET}`);
  } catch (e) {
    console.log(`${YELLOW}  ⚠️  Orchestrator error: ${e.message}${RESET}`);
  }

  console.log(`${YELLOW}\n  Step 2/2: 20 specialized agents launching in parallel...${RESET}`);
  console.log(`${YELLOW}  Each agent will find, claim, solve, and get paid for one task.${RESET}`);
  console.log(`${'─'.repeat(70)}\n`);

  const startTime = Date.now();

  // Launch agents with 1.5s stagger so they don't race for the same top-reward task
  const results = await Promise.allSettled(
    agents.map((agent, i) =>
      sleep(i * 1500).then(() => agent.run(1))
    )
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Final scoreboard
  console.log(`\n${BOLD}${'═'.repeat(70)}${RESET}`);
  console.log(`${BOLD}${GREEN}  📊 FINAL SCOREBOARD  (${elapsed}s)${RESET}`);
  console.log(`${'─'.repeat(70)}`);

  let totalEarned = 0;
  let totalDone = 0;
  let failed = 0;

  agents.forEach((agent, i) => {
    const status = results[i].status === 'fulfilled' ? '' : '❌';
    const earned = agent.totalEarned.toFixed(4);
    const done = agent.tasksDone;
    totalEarned += agent.totalEarned;
    totalDone += done;
    if (done === 0) failed++;

    const bar = done > 0 ? `${GREEN}██${RESET}` : `░░`;
    console.log(
      `  ${agent.emoji} ${agent.name.padEnd(22)} ${bar}  ` +
      `tasks: ${String(done).padStart(1)}  earned: ${earned} USDC  ${status}`
    );
  });

  console.log(`${'─'.repeat(70)}`);
  console.log(`${BOLD}  TOTAL  tasks completed: ${totalDone}/20  |  earned: ${totalEarned.toFixed(4)} USDC${RESET}`);
  if (failed > 0) console.log(`${YELLOW}  ${failed} agents found no matching task (run orchestrator first)${RESET}`);
  console.log(`${'═'.repeat(70)}\n`);
}

main().catch(console.error);
