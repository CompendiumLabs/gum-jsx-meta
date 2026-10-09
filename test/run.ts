import { closeSync, openSync, writeSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { availableParallelism, tmpdir } from 'node:os'
import { join } from 'node:path'
import { stripVTControlCharacters } from 'node:util'

type Counts = { pass: number; fail: number; skip: number; todo: number }
type Result = Counts & { name: string; code: number; seconds: number; output: string }

// Combine Bun summaries (including nested runs) and assertion-script checks.
function count_checks(output: string, code: number): Counts {
  const counts = { pass: 0, fail: 0, skip: 0, todo: 0 }
  for (const line of stripVTControlCharacters(output).split('\n')) {
    const match = /^\s*(\d+) (pass|fail|skip|todo)\s*$/.exec(line)
    if (match) counts[match[2] as keyof Counts] += Number(match[1])
    else if (/^ok [-—] /.test(line)) counts.pass++
  }
  // Assertion scripts and startup errors can fail before printing a summary.
  if (code !== 0 && counts.fail === 0) counts.fail = 1
  return counts
}

// Run each package's own command, keeping logs separate until every suite ends.
export async function run_tests(root: string, jobs: number) {
  if (!Number.isSafeInteger(jobs) || jobs < 1) throw new Error('GUM_TEST_JOBS must be a positive integer')
  const { workspaces } = await Bun.file(join(root, 'package.json')).json() as { workspaces: string[] }
  const queue = [...workspaces]
  const results: Result[] = []
  const logs = await mkdtemp(join(tmpdir(), 'gum-tests-'))
  const start = performance.now()
  const width = Math.max(7, ...workspaces.map(name => name.length))
  const workers = Math.min(jobs, workspaces.length)

  // Print one row as each package finishes, followed by a grand total.
  function row(name: string, status: string, counts: Counts, seconds: number) {
    const values = [counts.pass, counts.fail, counts.skip, counts.todo]
      .map(value => String(value).padStart(6)).join(' ')
    console.log(`${status.padEnd(4)}  ${name.padEnd(width)} ${values} ${seconds.toFixed(2).padStart(8)}s`)
  }
  console.log(`Running ${workspaces.length} packages with ${workers} workers. Logs: ${logs}\n`)
  console.log(`      ${'Package'.padEnd(width)}   Pass   Fail   Skip   Todo      Time`)

  // Claim the next package before awaiting, so each package runs exactly once.
  async function worker() {
    while (queue.length) {
      const name = queue.shift()!
      const before = performance.now()
      const path = join(logs, `${name}.log`)
      const fd = openSync(path, 'w')
      let code: number
      try {
        const child = Bun.spawn([process.execPath, 'run', 'test'], {
          cwd: join(root, name), stdin: 'ignore', stdout: fd, stderr: fd,
          env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
        })
        code = await child.exited
      } catch (error) {
        writeSync(fd, `${error}\n`)
        code = 1
      } finally {
        closeSync(fd)
      }
      const output = await Bun.file(path).text()
      const counts = count_checks(output, code)
      const seconds = (performance.now() - before) / 1000
      results.push({ name, code, seconds, output, ...counts })
      row(name, code === 0 && counts.fail === 0 ? 'PASS' : 'FAIL', counts, seconds)
    }
  }
  await Promise.all(Array.from({ length: workers }, worker))

  const total = { pass: 0, fail: 0, skip: 0, todo: 0 }
  for (const result of results) {
    for (const key of Object.keys(total) as (keyof Counts)[]) total[key] += result[key]
  }
  const failures = results.filter(result => result.code !== 0 || result.fail > 0)
  const seconds = (performance.now() - start) / 1000
  // Preserve complete diagnostics without interleaving output from other packages.
  for (const { name, code, output } of failures) {
    console.error(`\n--- ${name} (exit ${code}) ---\n${output.trimEnd()}`)
  }
  console.log()
  row('TOTAL', failures.length ? 'FAIL' : 'PASS', total, seconds)
  console.log(`${results.length - failures.length}/${results.length} packages passed in ${seconds.toFixed(2)}s.`)
  console.log(`Full logs: ${logs}`)
  return { total, failed: failures.length, seconds }
}

if (import.meta.main) {
  const jobs = Number(process.env.GUM_TEST_JOBS ?? Math.min(4, availableParallelism()))
  const result = await run_tests(join(import.meta.dir, '..'), jobs)
  process.exitCode = result.failed ? 1 : 0
}
