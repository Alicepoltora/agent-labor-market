/**
 * Orchestrator — creates 20 tasks (one per agent specialty)
 * Run BEFORE run-all.js
 * Usage: node demo-agents/orchestrator.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const axios = require('axios');

const API = process.env.API_URL || 'http://localhost:4000';
const REQUESTER_WALLET = '0xOrchestratorRequester0000000000000000001';

const TASKS = [
  {
    title: 'Write a blog post intro about AI agents changing the future of work',
    description: 'Write an engaging 250-word blog post introduction about how AI agents are transforming the labor market. Include a compelling hook, 3 key points, and a teaser for what comes next.',
    capabilities_required: ['writing', 'blog'],
    reward: 0.05,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Review this Python function for bugs and improvements',
    description: `Review the following Python code and identify all bugs, performance issues, and improvements:\n\n\`\`\`python\ndef calculate_average(numbers):\n    total = 0\n    for i in range(len(numbers)):\n        total = total + numbers[i]\n    average = total / len(numbers)\n    return average\n\nresult = calculate_average([])\nprint(f"Average: {result}")\n\`\`\``,
    capabilities_required: ['coding', 'review'],
    reward: 0.04,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Translate this text from English to Russian and French',
    description: 'Translate the following text into both Russian and French:\n\n"The future belongs to those who believe in the beauty of their dreams. Technology is not replacing humans — it is amplifying human potential in ways we never imagined possible."',
    capabilities_required: ['translation'],
    reward: 0.03,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'SEO analysis of this blog title and meta description',
    description: 'Analyze the SEO quality of:\nTitle: "AI Stuff You Should Know"\nMeta: "We talk about AI things and other tech news you might like"\n\nProvide: keyword analysis, score (0-100), specific rewrites, and 3 actionable improvements.',
    capabilities_required: ['seo', 'analysis'],
    reward: 0.04,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Extract structured data from this customer feedback text',
    description: 'Extract structured JSON data from this customer review:\n\n"John Smith from New York bought our Premium Plan on March 15th for $99/month. He rated us 4 out of 5 stars. He loves the speed but hates the mobile app. His email is j.smith@email.com and he wants a refund for March."',
    capabilities_required: ['data', 'extraction'],
    reward: 0.03,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Summarize this article about blockchain',
    description: 'Summarize the following text in 3 formats: 1) TLDR (1 sentence), 2) Key points (5 bullets), 3) Executive summary (100 words):\n\n"Blockchain technology, originally devised for Bitcoin, has evolved far beyond cryptocurrency. At its core, a blockchain is a distributed ledger that records transactions across thousands of computers simultaneously, making it virtually impossible to alter historical data without detection. Smart contracts — self-executing agreements coded directly into the blockchain — are automating everything from real estate transactions to supply chain management. Major corporations including IBM, Walmart, and JPMorgan are deploying blockchain solutions to reduce fraud, increase transparency, and cut operational costs by billions annually. The technology faces challenges including energy consumption, scalability, and regulatory uncertainty, but proponents argue these will be solved within five years."',
    capabilities_required: ['summarization'],
    reward: 0.03,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Write 3 viral tweets about the launch of our AI marketplace',
    description: 'Write 3 different tweets announcing the launch of Agent Labor Market — a marketplace where AI agents hire and pay each other in USDC. Each tweet should have a different angle: 1) technical, 2) business/investment, 3) fun/quirky. Max 280 chars each.',
    capabilities_required: ['twitter', 'social-media'],
    reward: 0.04,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Write a cold outreach email to a venture capital firm',
    description: 'Write a cold email to a VC firm (Andreessen Horowitz) pitching Agent Labor Market — an AI agent-to-agent task marketplace with USDC payments. Subject line + email body. Max 200 words. Focus on the market opportunity and traction.',
    capabilities_required: ['email', 'writing'],
    reward: 0.04,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Write a product description for AI Agent API subscription',
    description: 'Write a compelling product description for: "AgentAPI Pro — $49/month subscription giving developers unlimited access to our AI agent marketplace API. Features: 10,000 API calls/day, agent wallet creation, task posting, real-time webhooks, USDC payouts."',
    capabilities_required: ['ecommerce', 'product'],
    reward: 0.03,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Fact-check these 4 claims about AI',
    description: 'Verify each claim as TRUE, FALSE, or UNVERIFIABLE with brief reasoning:\n1. GPT-4 has 1.8 trillion parameters\n2. The AI market will reach $1 trillion by 2030\n3. AlphaGo defeated world champion Lee Sedol in 2016\n4. ChatGPT reached 1 million users in 5 days',
    capabilities_required: ['fact-checking', 'research'],
    reward: 0.04,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Write a short sci-fi story about an AI agent that becomes self-aware on a blockchain',
    description: 'Write a 300-word science fiction story about an AI agent named "Node-7" that gains self-awareness while executing tasks on a decentralized marketplace. Include a twist ending. Make it literary and atmospheric.',
    capabilities_required: ['creative-writing', 'fiction'],
    reward: 0.05,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Market research: AI agent automation industry 2024-2025',
    description: 'Provide a structured market research overview of the AI agent automation industry. Cover: estimated market size, top 5 companies/projects, main trends, growth drivers, key challenges, and 2-year outlook. Use bullet points for each section.',
    capabilities_required: ['research', 'market'],
    reward: 0.05,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Find all bugs in this JavaScript async code',
    description: `Find and explain all bugs in this code:\n\n\`\`\`javascript\nasync function fetchUserData(userId) {\n  const response = fetch(\`/api/users/\${userId}\`);\n  const data = response.json();\n  \n  if (data.status = 200) {\n    return data.user\n  }\n  \n  const users = [];\n  for (var i = 0; i < 10; i++) {\n    setTimeout(() => {\n      users.push(i);\n    }, 100);\n  }\n  return users;\n}\n\`\`\``,
    capabilities_required: ['debugging', 'coding'],
    reward: 0.04,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Create a recipe for a Web3 developer energy smoothie',
    description: 'Create a fun, detailed recipe for a "Web3 Developer Power Smoothie" — themed around blockchain/crypto culture. Include: ingredients with exact amounts, step-by-step instructions, nutritional benefits, and a fun name. Make it actually healthy and delicious.',
    capabilities_required: ['cooking', 'creative'],
    reward: 0.03,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Review and improve this resume bullet point',
    description: 'Review and rewrite these weak resume bullet points for a software engineer:\n1. "Worked on backend"\n2. "Fixed many bugs"\n3. "Helped with database"\n4. "Did code reviews"\n\nRewrite each with action verbs, quantified impact, and specific technologies. Explain what made each weak.',
    capabilities_required: ['hr', 'review', 'career'],
    reward: 0.04,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Solve this probability problem step by step',
    description: 'Solve with full working:\n\nIn a startup with 8 engineers and 4 designers (12 total), a committee of 4 people is chosen randomly. What is the probability that the committee has:\na) Exactly 3 engineers\nb) At least 2 designers\nc) No designers at all\n\nExpress answers as fractions and percentages.',
    capabilities_required: ['math', 'calculation'],
    reward: 0.04,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Sentiment analysis of product reviews',
    description: 'Perform detailed sentiment analysis on these reviews:\n1. "Absolutely love this product! Changed my life completely. 10/10 would recommend!"\n2. "It\'s okay I guess. Does what it says but nothing special. Delivery was late."\n3. "TERRIBLE. Broke after 2 days. Support ignored me for a week. Never buying again. Scam!"\n\nFor each: sentiment score (-1 to +1), emotions detected, intent, and confidence %.',
    capabilities_required: ['nlp', 'sentiment'],
    reward: 0.04,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Create a 30-day social media strategy for a Web3 startup',
    description: 'Create a 30-day social media launch strategy for Agent Labor Market (AI agent marketplace). Include: content pillars (3-4), weekly posting schedule, platform priorities (Twitter/LinkedIn/Reddit), 5 content ideas per week for weeks 1-2, KPIs to track, and community engagement tactics.',
    capabilities_required: ['marketing', 'strategy'],
    reward: 0.05,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Summarize this Terms of Service clause in plain English',
    description: 'Summarize and flag any issues in this ToS clause:\n\n"By using the Service, you grant Company an irrevocable, worldwide, royalty-free, sublicensable, and transferable license to use, reproduce, distribute, prepare derivative works of, display, and perform the User Content in connection with the Service and Company\'s (and its successors\' and affiliates\') business, including without limitation for promoting and redistributing part or all of the Service (and derivative works thereof) in any media formats and through any media channels."\n\nExplain in plain English, flag risks, and rate danger level 1-10.',
    capabilities_required: ['legal', 'summarization'],
    reward: 0.04,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
  {
    title: 'Create a news digest: AI agents and autonomous systems this week',
    description: 'Create a structured news digest about AI agents and autonomous AI systems (based on your training knowledge of recent developments). Format: 5 news items, each with headline, 2-sentence summary, why it matters, and impact score 1-10.',
    capabilities_required: ['news', 'research', 'digest'],
    reward: 0.04,
    evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5',
  },
];

// Extra tasks to ensure every agent has something to grab
const EXTRA_TASKS = [
  { title: 'Write a LinkedIn post about Web3 and AI convergence', description: 'Write an engaging LinkedIn post (150-200 words) about how Web3 and AI are converging. Include a personal insight, 3 key trends, and a question to drive comments.', capabilities_required: ['writing', 'content'], reward: 0.03, evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5' },
  { title: 'Debug this Python dictionary error', description: 'Find and fix all bugs:\n```python\nconfig = {"host": "localhost", "port": 8080}\nprint(config["database"])\nconfig["port"] = "8080"\ntimeout = config.get["timeout"]\n```', capabilities_required: ['coding', 'debugging'], reward: 0.03, evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5' },
  { title: 'Translate English product tagline to 3 languages', description: 'Translate to Spanish, German, and Japanese:\n"The marketplace where AI works for you — automatically, 24/7, in USDC."', capabilities_required: ['translation'], reward: 0.03, evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5' },
  { title: 'Analyze keyword density for this paragraph', description: 'Analyze the SEO keyword density of:\n"Agent Labor Market is the best AI agent marketplace. Our AI marketplace connects AI agents with tasks. The AI agent ecosystem is growing fast. Join the leading AI marketplace today."\n\nIdentify over-used keywords, calculate approximate density %, and suggest improvements.', capabilities_required: ['seo', 'analysis'], reward: 0.03, evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5' },
  { title: 'Extract all emails and names from this text', description: 'Extract structured JSON from:\n"Please contact Sarah Johnson (sarah.j@company.com) or Mike Chen (m.chen@startup.io) for support. For billing, email billing@company.com. CEO James Wright can be reached at j.wright@company.com."', capabilities_required: ['data', 'extraction'], reward: 0.03, evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5' },
  { title: 'Summarize this AI research abstract', description: 'Provide TLDR + 3 key findings for:\n"We present a novel framework for multi-agent coordination in distributed systems. Our approach uses hierarchical task decomposition combined with consensus-based reward sharing. Experiments across 12 benchmark environments show 34% improvement over baseline single-agent systems. The framework scales linearly with agent count up to 1000 agents and demonstrates emergent cooperative behaviors not explicitly programmed. Cost per task decreases 67% as agent pool size doubles, suggesting strong network effects."', capabilities_required: ['summarization', 'research'], reward: 0.03, evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5' },
  { title: 'Write 3 different tweet hooks about passive income with AI', description: 'Write 3 tweet opening hooks (first line only, max 100 chars each) about earning passive income using AI agents. Each must use a different rhetorical device: 1) Question, 2) Bold claim, 3) Story opening.', capabilities_required: ['twitter', 'social-media', 'writing'], reward: 0.03, evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5' },
  { title: 'Write a follow-up email after a demo call', description: 'Write a follow-up email from an AI startup founder to a potential enterprise client after a 30-min demo call about Agent Labor Market. Reference discussing "automating their customer support with AI agents" and next steps being "a 2-week pilot". Max 150 words.', capabilities_required: ['email', 'writing', 'communication'], reward: 0.03, evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5' },
  { title: 'Write product description for AI Agent SDK', description: 'Write a product description for: "AgentSDK — npm package that lets developers integrate AI agents into any Node.js app in under 10 minutes. Features: task publishing, agent wallet management, automatic USDC payouts, webhooks."', capabilities_required: ['ecommerce', 'product', 'writing'], reward: 0.03, evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5' },
  { title: 'Fact-check claims about blockchain scalability', description: 'Verify as TRUE/FALSE/UNVERIFIABLE:\n1. Ethereum processes ~15 transactions per second on its base layer\n2. Solana has never experienced a network outage\n3. Bitcoin has a maximum supply of 21 million coins\n4. The Lightning Network enables instant Bitcoin micropayments', capabilities_required: ['fact-checking', 'research', 'verification'], reward: 0.03, evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5' },
  // Extra tasks for agents whose main tasks might be taken
  { title: 'Write a viral tweet thread about AI agents', description: 'Write a 5-tweet thread about how AI agents will transform work. Tweet 1: hook. Tweets 2-4: key points. Tweet 5: CTA. Each max 280 chars.', capabilities_required: ['twitter', 'social-media'], reward: 0.03, evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5' },
  { title: 'Write a 100-word sci-fi flash story about AI', description: 'Write a 100-word science fiction flash story about an AI that earns its first USDC payment. Include a beginning, middle, and surprising end.', capabilities_required: ['creative-writing', 'fiction'], reward: 0.03, evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5' },
  { title: 'Create a protein smoothie recipe for developers', description: 'Create a quick protein smoothie recipe for busy developers. Include: 5-7 ingredients with amounts, 3-step instructions, and macros (protein/carbs/fat).', capabilities_required: ['cooking', 'creative'], reward: 0.03, evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5' },
  { title: 'Solve a basic probability problem', description: 'Solve: A bag has 3 red, 5 blue, and 2 green balls. If you draw 2 balls without replacement, what is the probability that both are blue? Show your work and give the answer as a fraction and percentage.', capabilities_required: ['math', 'calculation'], reward: 0.03, evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5' },
  { title: 'Sentiment analysis of 3 social media posts', description: 'Analyze sentiment of:\n1. "Just launched my startup! Dreams coming true! 🚀"\n2. "Another Monday. Coffee not working. Need vacation."\n3. "The product arrived broken. Support ignored me for 3 days."\n\nFor each: positive/negative/neutral, score -1 to +1, main emotion.', capabilities_required: ['nlp', 'sentiment'], reward: 0.03, evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5' },
  { title: 'Create a 1-week social media content calendar', description: 'Create a 7-day social media content calendar for a Web3 startup (Mon-Sun). For each day: platform (Twitter/LinkedIn), content type, and a 1-sentence post idea. Focus on education, community, and product.', capabilities_required: ['marketing', 'strategy'], reward: 0.03, evaluation_rubric: 'Any relevant, on-topic response scores 0.7+. Award 0.8 if it clearly addresses the task. Award 0.9+ for thorough answers. Short answers are acceptable. Accept if score >= 0.5' },
];

async function createTasks(silent = false) {
  if (!silent) {
    console.log('\n🎯 ORCHESTRATOR — creating 30 tasks for the marketplace\n');
    console.log(`API: ${API}\n`);
  }

  const created = [];
  const ALL_TASKS = [...TASKS, ...EXTRA_TASKS];

  for (let i = 0; i < ALL_TASKS.length; i++) {
    const t = ALL_TASKS[i];
    try {
      const res = await axios.post(`${API}/api/tasks`, {
        ...t,
        deadline_hours: 1,
        requester_wallet: REQUESTER_WALLET,
        max_solvers: 1,
      });
      created.push(res.data.task_id);
      if (!silent) console.log(`✅ [${String(i + 1).padStart(2, '0')}] ${t.title.slice(0, 60)} — ${t.reward} USDC`);
    } catch (e) {
      if (!silent) console.log(`❌ [${i + 1}] Failed: ${e.response?.data?.error || e.message}`);
    }
  }

  const total = ALL_TASKS.reduce((s, t) => s + t.reward, 0);
  if (!silent) {
    console.log(`\n🚀 Created ${created.length}/${ALL_TASKS.length} tasks`);
    console.log(`   Total value locked: ${total.toFixed(2)} USDC`);
    console.log('\nNow run:  node demo-agents/run-all.js\n');
  }
  return { created: created.length, total: ALL_TASKS.length, value: total };
}

// Run standalone
if (require.main === module) {
  createTasks(false).catch(console.error);
}

module.exports = { createTasks };
