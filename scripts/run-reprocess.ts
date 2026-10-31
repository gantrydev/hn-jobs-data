import fs from "node:fs/promises"
import path from "node:path"
import { aggregate, analyzeJobs } from "./analyze.js"
import { prepareJobText, readJSON, writeJSON } from "./utils.js"
import {
  ClassifiedDataSchema,
  validateTechnologyEvidence,
  type Analysis,
  type ClassifiedData,
  type RawData,
} from "./schemas.js"

// ==============================================================================
// Reprocess — re-run LLM analysis over existing raw.json for one or all runs.
//
// Usage: pnpm reprocess            # every run that has a raw.json
//        pnpm reprocess 2026-06-11 # a single run
//
// Rewrites analysis.json + classified.json in place using the current model and
// prompt — use after a prompt/schema change (e.g. the is_job gate). Does NOT
// refetch from HN. Run `pnpm index` afterwards to rebuild the index files.
// ==============================================================================

async function reprocess(date: string, normalize: boolean): Promise<void> {
  const runDir = path.resolve("runs", date)
  const raw = await readJSON<RawData>(path.join(runDir, "raw.json"))

  if (raw.total_jobs === 0) {
    console.warn(`  ${date}: raw.json has no jobs — skipping`)
    return
  }

  if (normalize) {
    const stored = await readJSON<ClassifiedData>(path.join(runDir, "classified.json"))
    const parsed = ClassifiedDataSchema.parse(stored)
    const classified = {
      ...stored,
      jobs: stored.jobs.map((job, i) => ({ ...job, ...parsed.jobs[i] })),
    }
    const rawIds = new Set(raw.jobs.map((job) => job.id))
    if (classified.jobs.some((job) => !rawIds.has(job.id))) {
      throw new Error(`${date}: classified jobs contain unknown IDs`)
    }
    for (const source of raw.jobs) {
      const job = classified.jobs.find((job) => job.id === source.id)
      if (job) validateTechnologyEvidence(job, prepareJobText(source.text))
    }
    const analysis = await readJSON<Analysis>(path.join(runDir, "analysis.json"))
    await writeJSON(path.join(runDir, "analysis.json"), {
      ...analysis,
      ...aggregate(classified.jobs),
      job_count: classified.jobs.length,
      generated_at: new Date().toISOString(),
    })
    await writeJSON(path.join(runDir, "classified.json"), classified)
    console.log(`  ${date}: normalized ${classified.jobs.length} existing classifications`)
    return
  }

  console.log(`\n🔁 Reprocessing ${date} (${raw.total_jobs} comments)...`)
  const { analysis, classifiedJobs } = await analyzeJobs(raw)

  await writeJSON(path.join(runDir, "analysis.json"), analysis)

  const classifiedData: ClassifiedData = {
    schema_version: "1.0",
    date: raw.date,
    run_id: raw.run_id,
    jobs: classifiedJobs,
    classified_at: new Date().toISOString(),
  }
  await writeJSON(path.join(runDir, "classified.json"), classifiedData)

  console.log(`  ${date}: ${classifiedJobs.length} jobs → analysis.json + classified.json`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const normalize = args.includes("--normalize")
  const only = args.find((arg) => arg !== "--normalize")

  let dates: string[]
  if (only) {
    dates = [only]
  } else {
    const runsDir = path.resolve("runs")
    const entries = await fs.readdir(runsDir)
    dates = []
    for (const entry of entries.sort()) {
      try {
        await fs.access(path.join(runsDir, entry, "raw.json"))
        dates.push(entry)
      } catch {
        continue
      }
    }
  }

  if (dates.length === 0) {
    console.error("No runs with a raw.json found.")
    process.exit(1)
  }

  console.log(`\nReprocessing ${dates.length} run(s): ${dates.join(", ")}`)
  for (const date of dates) await reprocess(date, normalize)

  console.log(`\n✅ Reprocessed ${dates.length} run(s). Run \`pnpm index\` to rebuild indexes.\n`)
}

main().catch((err) => {
  console.error("\n❌ Reprocess failed:", err)
  process.exit(1)
})
