const { spawn } = require('node-pty');
const { execSync } = require('child_process');
const fs = require('fs');

const pty = spawn('bash', [], { name: 'xterm-color', cols: 80, rows: 30 });
pty.write('ssh fakeuser@192.168.1.99\n');

setTimeout(() => {
  try {
    let out = `PID: ${pty.pid}\n`;
    const tpgidOut = execSync(`ps -o tpgid= -p ${pty.pid}`).toString().trim();
    out += `TPGID: ${tpgidOut}\n`;
    if (tpgidOut && tpgidOut !== String(pty.pid)) {
      const pids = execSync(`pgrep -g ${tpgidOut}`).toString().trim().split('\n').filter(Boolean);
      out += `PIDS: ${pids.join(', ')}\n`;
      if (pids.length > 0) {
         const psOut = execSync(`ps -o comm=,args= -p ${pids.join(',')}`).toString();
         out += `PS_OUT:\n${psOut}\n`;
      }
    }
    fs.writeFileSync('detect.log', out);
  } catch (e) {
    fs.writeFileSync('detect.log', `ERROR: ${e.message}`);
  }
  pty.kill();
  process.exit(0);
}, 2000);
