module.exports = {
  apps: [{
    name: 'cx-train-dev',
    script: 'node_modules/next/dist/bin/next',
    args: 'dev -p 3000',
    cwd: __dirname,
    env: { NODE_ENV: 'development' },
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 2000,
    exp_backoff_restart_delay: 100,
  }, {
    name: 'cloudflare-tunnel',
    script: '/usr/local/bin/cloudflared',
    args: 'tunnel --url http://localhost:3000',
    autorestart: true,
    max_restarts: 10,
    restart_delay: 2000,
  }]
};
