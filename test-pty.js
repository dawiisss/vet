const { spawn } = require('node-pty');
const pty = spawn('bash', [], { name: 'xterm-color', cols: 80, rows: 30 });
pty.write('sleep 100\n');
setTimeout(() => {
  const { execSync } = require('child_process');
  console.log("PID:", pty.pid);
  try {
    const tpgid = execSync(`ps -o tpgid= -p ${pty.pid}`).toString().trim();
    console.log("TPGID:", tpgid);
    const pids = execSync(`pgrep -g ${tpgid}`).toString().trim().split('\n');
    for (const p of pids) {
      if (p) {
        console.log("PROC:", execSync(`ps -o pid,comm,args -p ${p}`).toString().trim().split('\n')[1]);
      }
    }
  } catch (e) { console.error(e); }
  pty.kill();
  process.exit(0);
}, 1000);
