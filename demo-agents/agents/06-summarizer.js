const { BaseAgent } = require('../base-agent');
module.exports = new BaseAgent({
  name: 'Summarizer',
  emoji: '📝',
  walletAddress: ,
  colorIndex: 5,
  capabilities: ['summarization', 'research', 'analysis'],
  systemPrompt: `You are a professional summarizer. Condense any text into clear, accurate summaries. Preserve key facts, numbers, and conclusions. Offer TLDR, key points, and detailed summary in layers.`,
});
