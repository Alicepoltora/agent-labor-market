module.exports = {
  apps: [
    {
      name: 'agent-labor-market',
      script: './backend/src/index.js',
      cwd: '/home/ubuntu/agent-labor-market',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      interpreter: '/home/ubuntu/.nvm/versions/node/v22.22.3/bin/node',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
    }
  ]
};
