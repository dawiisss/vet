const { spawn } = require('node-pty');
const { execSync } = require('child_process');

const pty = spawn('bash', [], { name: 'xterm-color', cols: 80, rows: 30 });

setTimeout(() => {
  try {
    const tpgidOut = execSync(`ps -o tpgid= -p ${pty.pid}`).toString().trim();
    console.log(`PID: ${pty.pid}, TPGID: ${tpgidOut}`);
  } catch (e) {
    console.error(e.message);
  }
  pty.kill();
  process.exit(0);
}, 1000);
