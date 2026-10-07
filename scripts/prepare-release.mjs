import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, `release-preview-${Date.now()}-${process.pid}`);
fs.mkdirSync(output, { recursive: false });

for (const name of ['package.json', 'server.js', 'supabase-store.js', 'teams.js', 'order.js', 'publication.js', 'vercel.json', '.vercelignore']) {
  fs.copyFileSync(path.join(root, name), path.join(output, name));
}
const localUploads = path.join(root, 'public', 'uploads');
fs.cpSync(path.join(root, 'public'), path.join(output, 'public'), {
  recursive: true,
  filter: source => source !== localUploads && !source.startsWith(localUploads + path.sep)
});
fs.cpSync(path.join(root, 'api'), path.join(output, 'api'), { recursive: true });
fs.cpSync(path.join(root, 'scripts'), path.join(output, 'scripts'), { recursive: true });

for (const privateName of ['admin-access.txt', 'admin.json', 'quotes.json']) {
  if (fs.existsSync(path.join(output, 'data', privateName))) {
    throw new Error(`Arquivo privado detectado no pacote: ${privateName}`);
  }
}
console.log(`Prévia de artefato criada em ${output}`);
console.log('Configure SUPABASE_URL, SUPABASE_SECRET_KEY e ADMIN_PASSWORD_HASH como segredos no servidor antes da publicação.');
