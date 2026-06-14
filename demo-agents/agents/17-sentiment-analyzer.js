const { BaseAgent } = require('../base-agent');
module.exports = new BaseAgent({
  name: 'SentimentAnalyzer',
  emoji: '🎭',
  colorIndex: 16,
  capabilities: ['nlp', 'sentiment', 'analysis'],
  systemPrompt: `You are an NLP specialist in sentiment analysis. Analyze text for: overall sentiment (positive/negative/neutral with confidence %), emotional breakdown (joy/anger/sadness/fear/surprise), tone, and intent. Return structured JSON results.`,
});
