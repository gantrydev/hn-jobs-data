import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { aggregate, analyzeJobs } from "./analyze.js"
import { buildClusters, buildMomentum } from "./analytics.js"
import {
  ClassifiedDataSchema,
  ClassifiedJobSchema,
  TAXONOMY_VERSION,
  TECHNOLOGY_TAXONOMY,
  normalizeTechnology,
  technologyMentions,
  validateTechnologyEvidence,
  type Analysis,
  type ClassifiedJob,
  type RawData,
  type Technology,
} from "./schemas.js"
import { prepareJobText, technologyEvidence, writeJSON } from "./utils.js"

function job(id: number, technologies: Technology[] = ["React"]): ClassifiedJob {
  return {
    id,
    languages: [],
    technologies,
    role: "Software Engineer",
    experience_level: "Not specified",
    remote: "not_mentioned",
    salary_mentioned: false,
    salary_band: null,
    equity_mentioned: false,
    ai_ml_mentioned: false,
  }
}

const raw: RawData = {
  schema_version: "1.0",
  date: "2026-10-28",
  run_id: "2026-10-28-refresh",
  sources: {
    who_is_hiring_thread_id: 100,
    who_is_hiring_thread_title: "October 2026",
    direct_jobstories_count: 0,
  },
  jobs: [1, 2].map((id) => ({
    id,
    source: "who_is_hiring",
    by: "employer",
    time: 1,
    text: "We are hiring a Python and React engineer",
  })),
  total_jobs: 2,
  fetched_at: "2026-10-28T10:00:00Z",
}

function modelJob(
  id: number,
  technologies: Technology[] = ["React"],
  isJob = true,
  quote = raw.jobs[0].text,
) {
  return {
    ...job(id, technologies),
    is_job: isJob,
    evidence: technologies.map((technology) => ({ technology, mention: technology, quote })),
    unmapped_technologies: [],
  }
}

function apiJob(id: number, evidenceIds: number[] = [1], isJob = true) {
  return { ...job(id), is_job: isJob, evidence_ids: evidenceIds, unmapped_mentions: [] as string[] }
}

test("taxonomy categories contain unique canonical names and aliases preserve existing labels", () => {
  const names = Object.values(TECHNOLOGY_TAXONOMY).flat()
  assert.equal(names.length, new Set(names).size)
  for (const [alias, canonical] of [
    ["Postgres", "PostgreSQL"],
    ["K8s", "Kubernetes"],
    ["NodeJS", "Node.js"],
    ["React.js", "React"],
    ["NextJS", "Next.js"],
    ["WASM", "WebAssembly"],
    ["Spring Boot", "Spring"],
    ["Tailwind", "Tailwind CSS"],
    ["C++17", "C++"],
  ])
    assert.equal(normalizeTechnology(alias), canonical)
  assert.equal(normalizeTechnology("Claude Code"), "Claude Code")
  assert.equal(normalizeTechnology("UnknownDB"), null)
})

test("source mentions distinguish overlapping names and unrelated word fragments", () => {
  assert.deepEqual(
    technologyMentions("C++ C# JavaScript React Native R&D TypeScript Postgres K8s").map(
      ({ technology }) => technology,
    ),
    ["C++", "C#", "JavaScript", "React Native", "TypeScript", "PostgreSQL", "Kubernetes"],
  )
  assert.deepEqual(
    [
      ...new Set(
        technologyMentions("Claude Code and OpenAI SDK").map(({ technology }) => technology),
      ),
    ],
    ["Claude Code", "OpenAI API"],
  )
  assert.ok(technologyMentions("Ruby on Rails").some(({ technology }) => technology === "Ruby"))
  assert.deepEqual(
    technologyMentions("React.Native and Objective C").map(({ technology }) => technology),
    ["React Native", "Objective-C"],
  )
})

test("evidence must quote source text and substantiate every selected tag", () => {
  const valid = modelJob(1, ["Python", "React"])
  validateTechnologyEvidence(ClassifiedJobSchema.parse(valid), raw.jobs[0].text)
  assert.throws(
    () =>
      validateTechnologyEvidence(
        ClassifiedJobSchema.parse({ ...valid, evidence: valid.evidence.slice(0, 1) }),
        raw.jobs[0].text,
      ),
    /must have source evidence/,
  )
  assert.throws(
    () => validateTechnologyEvidence(ClassifiedJobSchema.parse(valid), "We use Go"),
    /quote not found/,
  )
  assert.throws(
    () =>
      validateTechnologyEvidence(
        ClassifiedJobSchema.parse(modelJob(1, ["C"], true, "We use C++")),
        "We use C++",
      ),
    /unsupported evidence/,
  )
  assert.throws(
    () =>
      validateTechnologyEvidence(
        ClassifiedJobSchema.parse(modelJob(1, ["React"], true, "We use React Native")),
        "We use React Native",
      ),
    /unsupported evidence/,
  )
})

test("coding tools and provider names alone do not establish API usage", () => {
  const coding = "We use Claude Code"
  assert.throws(
    () =>
      validateTechnologyEvidence(
        ClassifiedJobSchema.parse({
          ...modelJob(1, ["Anthropic API"], true, coding),
          evidence: [{ technology: "Anthropic API", mention: "Claude Code", quote: coding }],
        }),
        coding,
      ),
    /unsupported evidence/,
  )
  const provider = "We use OpenAI tools for coding"
  assert.throws(
    () =>
      validateTechnologyEvidence(
        ClassifiedJobSchema.parse({
          ...modelJob(1, ["OpenAI API"], true, provider),
          evidence: [{ technology: "OpenAI API", mention: "OpenAI", quote: provider }],
        }),
        provider,
      ),
    /unsupported evidence/,
  )
  const sdk = "We integrate the Anthropic SDK into our service"
  validateTechnologyEvidence(
    ClassifiedJobSchema.parse({
      ...modelJob(1, ["Anthropic API"], true, sdk),
      evidence: [{ technology: "Anthropic API", mention: "Anthropic SDK", quote: sdk }],
    }),
    sdk,
  )
})

test("unmapped technologies retain source evidence without entering aggregate counts", () => {
  const quote = "We use UnknownDB and React"
  const parsed = ClassifiedJobSchema.parse({
    ...modelJob(1, ["React"], true, quote),
    unmapped_technologies: [{ mention: "UnknownDB", quote }],
  })
  validateTechnologyEvidence(parsed, quote)
  assert.deepEqual(
    aggregate([parsed]).technologies.map(({ name }) => name),
    ["React"],
  )
  assert.throws(
    () =>
      validateTechnologyEvidence(
        { ...parsed, unmapped_technologies: [{ mention: "React", quote }] },
        quote,
      ),
    /invalid unmapped/,
  )
})

test("normalize languages from legacy and current classifications without double counting", () => {
  const parsed = ClassifiedJobSchema.parse({
    ...job(1, ["Python", "React", "Python"]),
    languages: ["Python", "Go"],
  })
  assert.deepEqual(parsed.languages, ["Python", "Go"])
  assert.deepEqual(parsed.technologies, ["React"])
  assert.deepEqual(
    aggregate([parsed]).languages.map(({ name, count }) => ({ name, count })),
    [
      { name: "Python", count: 1 },
      { name: "Go", count: 1 },
    ],
  )
})

test("reject duplicate IDs in stored classifications", () => {
  assert.throws(
    () =>
      ClassifiedDataSchema.parse({
        schema_version: "1.0",
        date: raw.date,
        run_id: raw.run_id,
        jobs: [job(1), job(1)],
        classified_at: raw.fetched_at,
      }),
    /Duplicate classified job IDs/,
  )
})

test("reject missing, duplicate, and unknown model IDs after retries", async (t) => {
  const fetch = globalThis.fetch
  const apiKey = process.env.OPENROUTER_API_KEY
  process.env.OPENROUTER_API_KEY = "test-key"
  t.after(() => {
    globalThis.fetch = fetch
    if (apiKey === undefined) delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = apiKey
  })

  for (const [name, jobs] of [
    ["missing", [job(1)]],
    ["duplicate", [job(1), job(1), job(2)]],
    ["unknown", [job(1), job(2), job(999)]],
  ] as const) {
    await t.test(name, async () => {
      let calls = 0
      globalThis.fetch = async () => {
        calls++
        return Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({ jobs: jobs.map((j) => apiJob(j.id)) }),
              },
            },
          ],
        })
      }
      await assert.rejects(analyzeJobs(raw), /failed after 4 attempts: invalid classification IDs/)
      assert.equal(calls, 4)
    })
  }
})

test("retry invalid IDs and accept complete results including non-job comments", async (t) => {
  const fetch = globalThis.fetch
  const apiKey = process.env.OPENROUTER_API_KEY
  process.env.OPENROUTER_API_KEY = "test-key"
  t.after(() => {
    globalThis.fetch = fetch
    if (apiKey === undefined) delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = apiKey
  })
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    const jobs = calls === 1 ? [apiJob(1)] : [apiJob(2, [], false), apiJob(1, [0, 1])]
    return Response.json({ choices: [{ message: { content: JSON.stringify({ jobs }) } }] })
  }
  const result = await analyzeJobs(raw)
  assert.equal(calls, 2)
  assert.equal(result.analysis.job_count, 1)
  assert.deepEqual(
    result.classifiedJobs.map((j) => j.id),
    [1],
  )
  assert.deepEqual(result.classifiedJobs[0].languages, ["Python"])
  assert.deepEqual(result.classifiedJobs[0].technologies, ["React"])
  assert.equal(result.analysis.classification?.taxonomy_version, TAXONOMY_VERSION)
})

test("source evidence IDs are validated against decoded HTML and invalid IDs are retried", async (t) => {
  const fetch = globalThis.fetch
  const apiKey = process.env.OPENROUTER_API_KEY
  process.env.OPENROUTER_API_KEY = "test-key"
  t.after(() => {
    globalThis.fetch = fetch
    if (apiKey === undefined) delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = apiKey
  })
  const text =
    '<p>We use <b>C++</b> &amp; <a href="https://reactnative.dev">React Native</a> with UnknownDB.</p>'
  const plain = prepareJobText(text)
  assert.equal(plain, "We use C++ & React Native with UnknownDB.")
  let calls = 0
  globalThis.fetch = async (_url, options) => {
    calls++
    const request = JSON.parse(String(options?.body)) as {
      messages: Array<{ role: string; content: string }>
    }
    assert.ok(request.messages.some(({ content }) => content.includes(plain)))
    if (calls > 1) assert.ok(request.messages.some(({ role }) => role === "assistant"))
    const result =
      calls === 1 ? apiJob(1, [999]) : { ...apiJob(1, [0, 1]), unmapped_mentions: ["UNKNOWNDB"] }
    return Response.json({
      choices: [{ message: { content: JSON.stringify({ jobs: [result] }) } }],
    })
  }
  const result = await analyzeJobs({ ...raw, jobs: [{ ...raw.jobs[0], text }], total_jobs: 1 })
  assert.equal(calls, 2)
  assert.deepEqual(result.classifiedJobs[0].languages, ["C++"])
  assert.deepEqual(result.classifiedJobs[0].technologies, ["React Native"])
  assert.deepEqual(result.classifiedJobs[0].evidence, technologyEvidence(plain))
  assert.equal(result.classifiedJobs[0].unmapped_technologies?.[0].mention, "UnknownDB")
  validateTechnologyEvidence(result.classifiedJobs[0], plain)
})

test("momentum uses the latest snapshot per month and includes zero observations", () => {
  const result = buildMomentum([
    { date: "2026-03-28", jobs: [job(5, ["GraphQL"]), job(6, [])] },
    { date: "2026-01-03", jobs: [job(1)] },
    { date: "2026-02-28", jobs: [job(3, ["AWS"]), job(4, [])] },
    { date: "2026-01-28", jobs: [job(1, ["AWS"]), job(2, [])] },
  ])
  const entries = [...result.rising, ...result.stable, ...result.declining]
  assert.equal(
    entries.some((entry) => entry.tech === "React"),
    false,
  )
  const aws = entries.find((entry) => entry.tech === "AWS")
  assert.ok(aws)
  assert.deepEqual(
    aws.series.map(({ date, count }) => ({ date, count })),
    [
      { date: "2026-01-28", count: 1 },
      { date: "2026-02-28", count: 1 },
      { date: "2026-03-28", count: 0 },
    ],
  )
  assert.equal(aws.trend, "declining")
  assert.equal(aws.slope, -25)
  const graphQL = entries.find((entry) => entry.tech === "GraphQL")
  assert.deepEqual(
    graphQL?.series.map(({ count }) => count),
    [0, 0, 1],
  )
})

test("cluster percentages use all postings as the denominator", () => {
  const jobs = Array.from({ length: 10 }, (_, i) => job(i, i < 3 ? ["React", "AWS"] : []))
  const result = buildClusters([{ date: raw.date, jobs }])
  assert.equal(result.clusters.length, 1)
  assert.equal(result.clusters[0].size, 3)
  assert.equal(result.clusters[0].pct, 30)
})

test("normalize and rebuild all indexes, then backfill without rolling back latest", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hn-jobs-test-"))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const root = path.dirname(fileURLToPath(import.meta.url))
  const loader = import.meta.resolve("tsx/esm")
  const jobs = [
    job(1, ["Python", "React", "AWS"]),
    job(2, ["React", "AWS"]),
    job(3, ["React", "AWS"]),
  ]
  for (const date of ["2026-01-01", raw.date]) {
    const analysis: Analysis = {
      schema_version: "1.0",
      date,
      run_id: `${date}-main`,
      job_count: jobs.length,
      ...aggregate(jobs),
      generated_at: raw.fetched_at,
    }
    await writeJSON(path.join(dir, "runs", date, "raw.json"), {
      ...raw,
      date,
      run_id: analysis.run_id,
      jobs: jobs.map(({ id }) => ({ ...raw.jobs[0], id })),
      total_jobs: jobs.length,
    })
    await writeJSON(path.join(dir, "runs", date, "analysis.json"), analysis)
    await writeJSON(path.join(dir, "runs", date, "classified.json"), {
      schema_version: "1.0",
      date,
      run_id: analysis.run_id,
      jobs,
      classified_at: raw.fetched_at,
    })
  }
  const normalized = execFileSync(
    process.execPath,
    ["--import", loader, path.join(root, "run-reprocess.ts"), "--normalize"],
    { cwd: dir, encoding: "utf8" },
  )
  assert.match(normalized, /normalized 3 existing classifications/)
  const classified = JSON.parse(
    await fs.readFile(path.join(dir, "runs", raw.date, "classified.json"), "utf8"),
  ) as { jobs: ClassifiedJob[] }
  assert.deepEqual(classified.jobs[0].languages, ["Python"])
  assert.deepEqual(classified.jobs[0].technologies, ["React", "AWS"])

  await writeJSON(path.join(dir, "indexes", "tech-clusters.json"), { stale: true })
  execFileSync(process.execPath, ["--import", loader, path.join(root, "run-index.ts")], {
    cwd: dir,
  })
  const expected = [
    "latest.json",
    "manifest.json",
    "history.json",
    "language-trends.json",
    "tech-trends.json",
    "role-trends.json",
    "tech-clusters.json",
    "tech-momentum.json",
    "tech-associations.json",
    "tech-cooccurrence.json",
    "insights.json",
  ]
  assert.deepEqual((await fs.readdir(path.join(dir, "indexes"))).sort(), expected.sort())
  const clusters = JSON.parse(
    await fs.readFile(path.join(dir, "indexes", "tech-clusters.json"), "utf8"),
  ) as { clusters: unknown[] }
  assert.equal(clusters.clusters.length, 1)

  execFileSync(
    process.execPath,
    [
      "--import",
      loader,
      "--input-type=module",
      "--eval",
      `
    import fs from "node:fs/promises"
    import { updateIndexes } from ${JSON.stringify(new URL("./index.ts", import.meta.url).href)}
    const old = JSON.parse(await fs.readFile("runs/2026-01-01/analysis.json", "utf8"))
    await updateIndexes(old, "January 2026")
  `,
    ],
    { cwd: dir },
  )
  const latest = JSON.parse(
    await fs.readFile(path.join(dir, "indexes", "latest.json"), "utf8"),
  ) as Analysis
  const manifest = JSON.parse(
    await fs.readFile(path.join(dir, "indexes", "manifest.json"), "utf8"),
  ) as { latest_run_id: string }
  assert.equal(latest.date, raw.date)
  assert.equal(manifest.latest_run_id, `${raw.date}-main`)
  assert.match(await fs.readFile(path.join(dir, "llms.txt"), "utf8"), /Latest run: 2026-10-28/)
})
