const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const update = process.argv.includes('--update');

/* Update `checks` whenever assertions are added or removed; the runner fails
   when a suite's PASS count drifts from this table. `--update` rewrites it
   after a clean run. */
const suites = [
  {name: 'patterns', checks: 69},
  {name: 'wallet', checks: 106},
  {name: 'solo', checks: 78},
  {name: 'solo-bots', checks: 68},
  {name: 'gift', checks: 22},
  {name: 'rooms', checks: 37}
];

function duration(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

/* Run one suite with live output, counting its PASS lines as they stream. */
function runSuite(name) {
  return new Promise(resolve => {
    const started = process.hrtime.bigint();
    let passes = 0;
    let pending = '';
    const count = chunk => {
      pending += chunk;
      const lines = pending.split('\n');
      pending = lines.pop();
      passes += lines.filter(line => line.startsWith('PASS ')).length;
    };
    const child = spawn(process.execPath, [path.join(__dirname, `${name}.test.js`)], {
      stdio: ['inherit', 'pipe', 'inherit']
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      process.stdout.write(chunk);
      count(chunk);
    });
    child.on('error', error => {
      console.error('RUNNER ERROR: ' + error.message);
      resolve({name, code: 1, signal: null, passes, ms: Number(process.hrtime.bigint() - started) / 1e6});
    });
    child.on('close', (code, signal) => {
      if (pending.startsWith('PASS ')) passes += 1;
      resolve({name, code, signal, passes, ms: Number(process.hrtime.bigint() - started) / 1e6});
    });
  });
}

/* Rewrite the `checks` numbers in this file, leaving everything else alone. */
function writeCounts(results) {
  let source = fs.readFileSync(__filename, 'utf8');
  for (const result of results) {
    const row = new RegExp(`(\\{name: '${result.name}', checks: )\\d+(\\})`);
    if (!row.test(source)) throw new Error(`missing checks row for ${result.name}`);
    source = source.replace(row, `$1${result.passes}$2`);
  }
  fs.writeFileSync(__filename, source);
}

(async () => {
  const results = [];
  for (const suite of suites) {
    console.log(`\n=== ${suite.name} ===`);
    const result = await runSuite(suite.name);
    result.expected = suite.checks;
    result.ok = result.code === 0 && (update || result.passes === suite.checks);
    results.push(result);
    if (result.code !== 0) {
      console.log(`FAILED: ${suite.name}${result.signal ? ` (${result.signal})` : ''}`);
    } else if (!update && result.passes !== suite.checks) {
      console.log(`CHECK COUNT: ${suite.name} expected ${suite.checks}, counted ${result.passes} — update the table in tests/run.js`);
    }
  }

  const failed = results.filter(result => result.code !== 0).length;
  const total = results.reduce((sum, result) => sum + result.passes, 0);
  const wall = results.reduce((sum, result) => sum + result.ms, 0);

  if (update) {
    if (failed) {
      console.log(`\n${failed} suite(s) failed — expected counts not updated`);
      process.exit(1);
    }
    writeCounts(results);
  }

  console.log('\n=== summary ===');
  for (const result of results) {
    const status = result.ok ? 'PASS' : 'FAIL';
    const counts = update ? String(result.passes).padStart(3) : `${result.passes}/${result.expected}`.padStart(7);
    console.log(`${status} ${result.name.padEnd(10)} ${counts} checks ${duration(result.ms).padStart(7)}`);
  }

  if (update) {
    const changed = results.filter(result => result.passes !== result.expected);
    console.log(changed.length
      ? `\nUpdated expected counts in tests/run.js: ${changed.map(result => `${result.name} ${result.expected} -> ${result.passes}`).join(', ')} — ${total} checks in ${duration(wall)}`
      : `\nAll suites passed — counts unchanged, ${total} checks in ${duration(wall)}`);
    process.exit(0);
  }

  const expectedTotal = suites.reduce((sum, suite) => sum + suite.checks, 0);
  const broken = results.filter(result => !result.ok).length;
  console.log(broken
    ? `\n${broken} suite(s) failed — ${total} of ${expectedTotal} checks ran in ${duration(wall)}`
    : `\nAll suites passed — ${total} checks in ${duration(wall)}`);
  process.exit(broken ? 1 : 0);
})();
