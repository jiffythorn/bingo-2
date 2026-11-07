const { spawnSync } = require('child_process');
const path = require('path');

const suites = ['patterns', 'wallet', 'solo', 'gift', 'rooms'];
let failed = 0;

for (const name of suites) {
  console.log(`\n=== ${name} ===`);
  const res = spawnSync(process.execPath, [path.join(__dirname, `${name}.test.js`)], { stdio: 'inherit' });
  if (res.status !== 0) {
    failed += 1;
    console.log(`FAILED: ${name}${res.signal ? ` (${res.signal})` : ''}`);
  }
}

console.log(failed ? `\n${failed} suite(s) failed` : '\nAll suites passed');
process.exit(failed ? 1 : 0);
