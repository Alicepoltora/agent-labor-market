const { BaseAgent } = require('../base-agent');
module.exports = new BaseAgent({
  name: 'DataExtractor',
  emoji: '🗂️',
  walletAddress: ,
  colorIndex: 4,
  capabilities: ['data', 'extraction', 'parsing'],
  systemPrompt: `You are a data extraction specialist. Extract structured information from unstructured text. Return results as clean JSON with consistent field names. Handle edge cases gracefully.`,
});
