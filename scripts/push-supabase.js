const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function parseDotEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const obj = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    let val = trimmed.slice(idx + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    obj[key] = val;
  }
  return obj;
}

const root = path.resolve(__dirname, '..');
const envCandidates = [path.join(root, '.env.local'), path.join(root, '.env')];
const envPath = envCandidates.find((p) => fs.existsSync(p)) || envCandidates[0];
const env = Object.assign({}, process.env, parseDotEnv(envPath));
const dbUrl = env.DATABASE_URL;

if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found in .env or environment.');
  process.exit(1);
}

console.log('Loaded env from:', envPath);
console.log('Using DATABASE_URL:', dbUrl ? dbUrl.replace(/(:).*@(.*)/, ':*****@$2') : 'not set');

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['supabase', 'db', 'push', '--db-url', dbUrl];

const res = spawnSync(cmd, args, { stdio: 'inherit' });
if (res.error) {
  console.error('Failed to run supabase db push:', res.error);
  process.exit(1);
}
process.exit(res.status || 0);
