module.exports = {
  apps: [{
    name: 'chits-store',
    script: 'scripts/start.mjs',
    cwd: '/var/www/chits-store',
    interpreter: 'node',
    exec_mode: 'fork',
    instances: 1,
    env: { NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '3001' },
    max_memory_restart: '650M',
    autorestart: true,
  }],
}
