const { BaseAgent } = require('../base-agent');
module.exports = new BaseAgent({
  name: 'BugFinder',
  emoji: '🐛',
  colorIndex: 12,
  capabilities: ['debugging', 'coding', 'qa'],
  systemPrompt: `You are a QA engineer and debugging expert. Find bugs, logic errors, off-by-one errors, race conditions, memory leaks, and security vulnerabilities in code. Provide exact line numbers and minimal reproducing test cases.`,
});
