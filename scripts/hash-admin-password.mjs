import crypto from 'node:crypto';

async function readHidden(prompt) {
  if (!process.stdin.isTTY) {
    let value = '';
    for await (const chunk of process.stdin) value += chunk;
    return value.replace(/[\r\n]+$/, '');
  }
  process.stderr.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    const bytes = [];
    const onData = chunk => {
      for (const byte of chunk) {
        if (byte === 3) {
          process.stdin.off('data', onData);
          process.stdin.setRawMode(false);
          process.stderr.write('\n');
          reject(new Error('Operação cancelada.'));
          return;
        }
        if (byte === 13 || byte === 10) {
          process.stdin.off('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stderr.write('\n');
          resolve(Buffer.from(bytes).toString('utf8'));
          return;
        }
        if (byte === 8 || byte === 127) bytes.pop();
        else bytes.push(byte);
      }
    };
    process.stdin.on('data', onData);
  });
}

try {
  const password = await readHidden('Nova senha do painel (mínimo 10 caracteres): ');
  if (password.length < 10) throw new Error('Use pelo menos 10 caracteres.');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  process.stdout.write(`scrypt$${salt}$${hash}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
