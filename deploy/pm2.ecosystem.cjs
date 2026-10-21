module.exports = {
  apps: [{
    name: 'chits-store',
    script: '.output/server/index.mjs',
    cwd: '/var/www/chits-store',
    interpreter: 'node',
    node_args: '--env-file=.env',
    exec_mode: 'fork',
    instances: 1,
    env: { NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '3001' },
    max_memory_restart: '650M',
    autorestart: true,
  }],
}
