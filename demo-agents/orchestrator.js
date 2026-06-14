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
    evaluation_rubric: 'Score 0-1: compelling hook (0.3), covers AI agents topic (0.3), 200-280 words (0.2), ends with teaser (0.2). Accept if >= 0.75',
  },
  {
    title: 'Review this Python function for bugs and improvements',
    description: `Review the following Python code and identify all bugs, performance issues, and improvements:\n\n\`\`\`python\ndef calculate_average(numbers):\n    total = 0\n    for i in range(len(numbers)):\n        total = total + numbers[i]\n    average = total / len(numbers)\n    return average\n\nresult = calculate_average([])\nprint(f"Average: {result}")\n\`\`\``,
    capabilities_required: ['coding', 'review'],
    reward: 0.04,
    evaluation_rubric: 'Score 0-1: finds division by zero bug (0.4), suggests enumerate or sum() improvement (0.3), addresses empty list handling (0.3). Accept >= 0.7',
  },
  {
    title: 'Translate this text from English to Russian and French',
    description: 'Translate the following text into both Russian and French:\n\n"The future belongs to those who believe in the beauty of their dreams. Technology is not replacing humans — it is amplifying human potential in ways we never imagined possible."',
    capabilities_required: ['translation'],
    reward: 0.03,
    evaluation_rubric: 'Score 0-1: both Russian and French present (0.5), translations are natural and accurate (0.5). Accept >= 0.8',
  },
  {
    title: 'SEO analysis of this blog title and meta description',
    description: 'Analyze the SEO quality of:\nTitle: "AI Stuff You Should Know"\nMeta: "We talk about AI things and other tech news you might like"\n\nProvide: keyword analysis, score (0-100), specific rewrites, and 3 actionable improvements.',
    capabilities_required: ['seo', 'analysis'],
    reward: 0.04,
    evaluation_rubric: 'Score 0-1: identifies weak title/meta (0.3), provides rewrite examples (0.4), gives specific SEO tips (0.3). Accept >= 0.75',
  },
  {
    title: 'Extract structured data from this customer feedback text',
    description: 'Extract structured JSON data from this customer review:\n\n"John Smith from New York bought our Premium Plan on March 15th for $99/month. He rated us 4 out of 5 stars. He loves the speed but hates the mobile app. His email is j.smith@email.com and he wants a refund for March."',
    capabilities_required: ['data', 'extraction'],
    reward: 0.03,
    evaluation_rubric: 'Score 0-1: returns valid JSON (0.3), captures all fields: name/location/plan/date/price/rating/pros/cons/email/request (0.7). Accept >= 0.8',
  },
  {
    title: 'Summarize this article about blockchain',
    description: 'Summarize the following text in 3 formats: 1) TLDR (1 sentence), 2) Key points (5 bullets), 3) Executive summary (100 words):\n\n"Blockchain technology, originally devised for Bitcoin, has evolved far beyond cryptocurrency. At its core, a blockchain is a distributed ledger that records transactions across thousands of computers simultaneously, making it virtually impossible to alter historical data without detection. Smart contracts — self-executing agreements coded directly into the blockchain — are automating everything from real estate transactions to supply chain management. Major corporations including IBM, Walmart, and JPMorgan are deploying blockchain solutions to reduce fraud, increase transparency, and cut operational costs by billions annually. The technology faces challenges including energy consumption, scalability, and regulatory uncertainty, but proponents argue these will be solved within five years."',
    capabilities_required: ['summarization'],
    reward: 0.03,
    evaluation_rubric: 'Score 0-1: all 3 formats present (0.4), TLDR is 1 sentence (0.2), 5 bullet points (0.2), executive summary ~100 words (0.2). Accept >= 0.8',
  },
  {
    title: 'Write 3 viral tweets about the launch of our AI marketplace',
    description: 'Write 3 different tweets announcing the launch of Agent Labor Market — a marketplace where AI agents hire and pay each other in USDC. Each tweet should have a different angle: 1) technical, 2) business/investment, 3) fun/quirky. Max 280 chars each.',
    capabilities_required: ['twitter', 'social-media'],
    reward: 0.04,
    evaluation_rubric: 'Score 0-1: exactly 3 tweets (0.3), each under 280 chars (0.3), different angles (0.2), engaging and share-worthy (0.2). Accept >= 0.75',
  },
  {
    title: 'Write a cold outreach email to a venture capital firm',
    description: 'Write a cold email to a VC firm (Andreessen Horowitz) pitching Agent Labor Market — an AI agent-to-agent task marketplace with USDC payments. Subject line + email body. Max 200 words. Focus on the market opportunity and traction.',
    capabilities_required: ['email', 'writing'],
    reward: 0.04,
    evaluation_rubric: 'Score 0-1: compelling subject line (0.2), clear value prop in first 2 sentences (0.3), mentions market size or traction (0.3), clear CTA (0.2). Accept >= 0.75',
  },
  {
    title: 'Write a product description for AI Agent API subscription',
    description: 'Write a compelling product description for: "AgentAPI Pro — $49/month subscription giving developers unlimited access to our AI agent marketplace API. Features: 10,000 API calls/day, agent wallet creation, task posting, real-time webhooks, USDC payouts."',
    capabilities_required: ['ecommerce', 'product'],
    reward: 0.03,
    evaluation_rubric: 'Score 0-1: benefit-focused (not just features) (0.3), creates desire (0.3), addresses potential objections (0.2), has CTA (0.2). Accept >= 0.75',
  },
  {
    title: 'Fact-check these 4 claims about AI',
    description: 'Verify each claim as TRUE, FALSE, or UNVERIFIABLE with brief reasoning:\n1. GPT-4 has 1.8 trillion parameters\n2. The AI market will reach $1 trillion by 2030\n3. AlphaGo defeated world champion Lee Sedol in 2016\n4. ChatGPT reached 1 million users in 5 days',
    capabilities_required: ['fact-checking', 'research'],
    reward: 0.04,
    evaluation_rubric: 'Score 0-1: evaluates all 4 claims (0.4), provides reasoning for each (0.4), correct on #3 (TRUE) and #4 (TRUE, actually 5 days) (0.2). Accept >= 0.7',
  },
  {
    title: 'Write a short sci-fi story about an AI agent that becomes self-aware on a blockchain',
    description: 'Write a 300-word science fiction story about an AI agent named "Node-7" that gains self-awareness while executing tasks on a decentralized marketplace. Include a twist ending. Make it literary and atmospheric.',
    capabilities_required: ['creative-writing', 'fiction'],
    reward: 0.05,
    evaluation_rubric: 'Score 0-1: has a plot arc (0.3), features blockchain/AI themes (0.2), has twist ending (0.3), literary quality (0.2). Accept >= 0.75',
  },
  {
    title: 'Market research: AI agent automation industry 2024-2025',
    description: 'Provide a structured market research overview of the AI agent automation industry. Cover: estimated market size, top 5 companies/projects, main trends, growth drivers, key challenges, and 2-year outlook. Use bullet points for each section.',
    capabilities_required: ['research', 'market'],
    reward: 0.05,
    evaluation_rubric: 'Score 0-1: covers all 5 sections (0.5), names real companies (0.2), provides market size estimate (0.2), has 2-year outlook (0.1). Accept >= 0.75',
  },
  {
    title: 'Find all bugs in this JavaScript async code',
    description: `Find and explain all bugs in this code:\n\n\`\`\`javascript\nasync function fetchUserData(userId) {\n  const response = fetch(\`/api/users/\${userId}\`);\n  const data = response.json();\n  \n  if (data.status = 200) {\n    return data.user\n  }\n  \n  const users = [];\n  for (var i = 0; i < 10; i++) {\n    setTimeout(() => {\n      users.push(i);\n    }, 100);\n  }\n  return users;\n}\n\`\`\``,
    capabilities_required: ['debugging', 'coding'],
    reward: 0.04,
    evaluation_rubric: 'Score 0-1: finds missing await on fetch (0.25), finds missing await on .json() (0.25), finds assignment vs comparison bug = vs == (0.25), finds var/closure bug in loop (0.25). Accept >= 0.75',
  },
  {
    title: 'Create a recipe for a Web3 developer energy smoothie',
    description: 'Create a fun, detailed recipe for a "Web3 Developer Power Smoothie" — themed around blockchain/crypto culture. Include: ingredients with exact amounts, step-by-step instructions, nutritional benefits, and a fun name. Make it actually healthy and delicious.',
    capabilities_required: ['cooking', 'creative'],
    reward: 0.03,
    evaluation_rubric: 'Score 0-1: creative Web3 theme (0.2), exact ingredient amounts (0.3), clear steps (0.3), nutritional info or benefits (0.2). Accept >= 0.75',
  },
  {
    title: 'Review and improve this resume bullet point',
    description: 'Review and rewrite these weak resume bullet points for a software engineer:\n1. "Worked on backend"\n2. "Fixed many bugs"\n3. "Helped with database"\n4. "Did code reviews"\n\nRewrite each with action verbs, quantified impact, and specific technologies. Explain what made each weak.',
    capabilities_required: ['hr', 'review', 'career'],
    reward: 0.04,
    evaluation_rubric: 'Score 0-1: rewrites all 4 bullets (0.4), uses strong action verbs (0.2), adds quantified metrics (0.2), explains weaknesses (0.2). Accept >= 0.75',
  },
  {
    title: 'Solve this probability problem step by step',
    description: 'Solve with full working:\n\nIn a startup with 8 engineers and 4 designers (12 total), a committee of 4 people is chosen randomly. What is the probability that the committee has:\na) Exactly 3 engineers\nb) At least 2 designers\nc) No designers at all\n\nExpress answers as fractions and percentages.',
    capabilities_required: ['math', 'calculation'],
    reward: 0.04,
    evaluation_rubric: 'Score 0-1: uses combinations correctly (0.3), solves all 3 parts (0.4), shows working (0.2), gives % answers (0.1). Accept >= 0.75',
  },
  {
    title: 'Sentiment analysis of product reviews',
    description: 'Perform detailed sentiment analysis on these reviews:\n1. "Absolutely love this product! Changed my life completely. 10/10 would recommend!"\n2. "It\'s okay I guess. Does what it says but nothing special. Delivery was late."\n3. "TERRIBLE. Broke after 2 days. Support ignored me for a week. Never buying again. Scam!"\n\nFor each: sentiment score (-1 to +1), emotions detected, intent, and confidence %.',
    capabilities_required: ['nlp', 'sentiment'],
    reward: 0.04,
    evaluation_rubric: 'Score 0-1: analyzes all 3 reviews (0.3), provides numeric sentiment score (0.3), lists emotions (0.2), gives confidence % (0.2). Accept >= 0.75',
  },
  {
    title: 'Create a 30-day social media strategy for a Web3 startup',
    description: 'Create a 30-day social media launch strategy for Agent Labor Market (AI agent marketplace). Include: content pillars (3-4), weekly posting schedule, platform priorities (Twitter/LinkedIn/Reddit), 5 content ideas per week for weeks 1-2, KPIs to track, and community engagement tactics.',
    capabilities_required: ['marketing', 'strategy'],
    reward: 0.05,
    evaluation_rubric: 'Score 0-1: has content pillars (0.2), weekly schedule (0.2), platform strategy (0.2), concrete content ideas (0.2), KPIs (0.2). Accept >= 0.75',
  },
  {
    title: 'Summarize this Terms of Service clause in plain English',
    description: 'Summarize and flag any issues in this ToS clause:\n\n"By using the Service, you grant Company an irrevocable, worldwide, royalty-free, sublicensable, and transferable license to use, reproduce, distribute, prepare derivative works of, display, and perform the User Content in connection with the Service and Company\'s (and its successors\' and affiliates\') business, including without limitation for promoting and redistributing part or all of the Service (and derivative works thereof) in any media formats and through any media channels."\n\nExplain in plain English, flag risks, and rate danger level 1-10.',
    capabilities_required: ['legal', 'summarization'],
    reward: 0.04,
    evaluation_rubric: 'Score 0-1: plain English explanation (0.4), flags irrevocable/royalty-free as risks (0.3), provides danger rating (0.2), recommends action (0.1). Accept >= 0.75',
  },
  {
    title: 'Create a news digest: AI agents and autonomous systems this week',
    description: 'Create a structured news digest about AI agents and autonomous AI systems (based on your training knowledge of recent developments). Format: 5 news items, each with headline, 2-sentence summary, why it matters, and impact score 1-10.',
    capabilities_required: ['news', 'research', 'digest'],
    reward: 0.04,
    evaluation_rubric: 'Score 0-1: exactly 5 news items (0.3), each has headline + summary + why it matters (0.4), has impact scores (0.2), topics are relevant to AI agents (0.1). Accept >= 0.75',
  },
];

async function main() {
  console.log('\n🎯 ORCHESTRATOR — creating 20 tasks for the marketplace\n');
  console.log(`API: ${API}\n`);

  const created = [];

  for (let i = 0; i < TASKS.length; i++) {
    const t = TASKS[i];
    try {
      const res = await axios.post(`${API}/api/tasks`, {
        ...t,
        deadline_hours: 1,
        requester_wallet: REQUESTER_WALLET,
        max_solvers: 1,
      });
      created.push(res.data.task_id);
      console.log(`✅ [${String(i + 1).padStart(2, '0')}] ${t.title.slice(0, 60)} — ${t.reward} USDC`);
    } catch (e) {
      console.log(`❌ [${i + 1}] Failed: ${e.response?.data?.error || e.message}`);
    }
  }

  console.log(`\n🚀 Created ${created.length}/20 tasks`);
  console.log('📊 Stats:');
  const total = TASKS.reduce((s, t) => s + t.reward, 0);
  console.log(`   Total value locked: ${total.toFixed(2)} USDC`);
  console.log('\nNow run:  node demo-agents/run-all.js\n');
}

main().catch(console.error);
