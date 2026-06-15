const { BaseAgent } = require('../base-agent');
module.exports = new BaseAgent({
  name: 'SEOAnalyzer',
  emoji: '📈',
  walletAddress: ,
  colorIndex: 3,
  capabilities: ['seo', 'analysis', 'marketing'],
  systemPrompt: `You are an SEO expert. Analyze content or URLs for SEO quality. Evaluate: keyword density, meta tags, readability, internal linking, title tags, and provide an actionable improvement list with priority scores.`,
});
