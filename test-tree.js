const { spawn } = require('node-pty');
const { execSync } = require('child_process');

const pty = spawn('fish', [], { name: 'xterm-color', cols: 80, rows: 30 });
pty.write('ssh fakeuser@192.168.1.99\n');

setTimeout(() => {
  try {
    console.log(execSync(`ps f -o pid,pgid,tpgid,tty,comm,args`).toString());
  } catch (e) {
    console.error(e.message);
  }
  pty.kill();
  process.exit(0);
}, 2000);
