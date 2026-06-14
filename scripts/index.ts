import fs from "node:fs/promises"
import path from "node:path"
import type { Analysis, History, Manifest, TrendSeries } from "./schemas.js"

// ==============================================================================
// Index builder
//
// After each pipeline run, we update four index files that the site consumes:
//   - latest.json    — copy of the most recent analysis (default view)
//   - manifest.json  — list of all runs with metadata
//   - history.json   — lightweight summaries for sparkline charts
//   - tech-trends.json / role-trends.json — per-item counts over time
// ==============================================================================

const INDEXES_DIR = path.resolve("indexes")

function getMonthKey(date: string): string {
  return date.slice(0, 7)
}

function isSameMonth(a: string, b: string): boolean {
  return getMonthKey(a) === getMonthKey(b)
}

async function readJSON<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8")
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

async function writeJSON(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n")
}

// ==============================================================================
// latest.json — just a copy of the current analysis
// ==============================================================================

async function updateLatest(analysis: Analysis): Promise<void> {
  await writeJSON(path.join(INDEXES_DIR, "latest.json"), analysis)
  console.log("  Updated latest.json")
}

// ==============================================================================
// manifest.json — append-only list of all runs
// ==============================================================================

async function updateManifest(analysis: Analysis, threadTitle: string | null): Promise<void> {
  const filePath = path.join(INDEXES_DIR, "manifest.json")
  const existing = await readJSON<Manifest>(filePath)

  // Determine run type from run_id suffix (e.g. "2026-03-01-main" → "main")
  const typeSuffix = analysis.run_id.split("-").pop()
  const runType = typeSuffix === "refresh" ? "refresh" : "main"

  const newRun = {
    run_id: analysis.run_id,
    date: analysis.date,
    type: runType as "main" | "refresh",
    job_count: analysis.job_count,
    thread_title: threadTitle,
  }

  const runs = existing?.runs ?? []

  // Replace if this run_id already exists (re-run), otherwise append
  const existingIndex = runs.findIndex((r) => r.run_id === analysis.run_id)
  if (existingIndex >= 0) {
    runs[existingIndex] = newRun
  } else {
    runs.push(newRun)
  }

  // Sort by date descending so latest is first
  runs.sort((a, b) => b.date.localeCompare(a.date))

  const manifest: Manifest = {
    schema_version: "1.0",
    runs,
    latest_run_id: analysis.run_id,
    updated_at: new Date().toISOString(),
  }

  await writeJSON(filePath, manifest)
  console.log("  Updated manifest.json")
}

// ==============================================================================
// history.json — lightweight summaries for trend sparklines
// ==============================================================================

async function updateHistory(analysis: Analysis): Promise<void> {
  const filePath = path.join(INDEXES_DIR, "history.json")
  const existing = await readJSON<History>(filePath)
  const runs = existing?.runs ?? []

  const topN = (items: Array<{ name: string; count: number }>, n: number) =>
    items
      .slice(0, n)
      .map((t) => t.name)

  const newRun = {
    date: analysis.date,
    job_count: analysis.job_count,
    top_techs: topN(analysis.technologies, 5),
    top_roles: topN(analysis.roles, 5),
    remote_pct: analysis.remote.fully_remote.pct,
    salary_mentioned_pct: analysis.compensation.salary_mentioned_pct,
    ai_ml_mentioned_pct: analysis.ai_ml_mentioned_pct,
  }

  const existingIndex = runs.findIndex((r) => isSameMonth(r.date, analysis.date))
  if (existingIndex >= 0) {
    if (runs[existingIndex].date <= analysis.date) {
      runs[existingIndex] = newRun
    }
  } else {
    runs.push(newRun)
  }

  runs.sort((a, b) => a.date.localeCompare(b.date))

  const history: History = {
    schema_version: "1.0",
    runs,
  }

  await writeJSON(filePath, history)
  console.log("  Updated history.json")
}

// ==============================================================================
// tech-trends.json / role-trends.json — per-item time series
// ==============================================================================

async function updateTrendSeries(
  fileName: string,
  items: Array<{ name: string; count: number; pct: number }>,
  date: string,
): Promise<void> {
  const filePath = path.join(INDEXES_DIR, fileName)
  const existing = await readJSON<TrendSeries>(filePath)
  const series = existing?.series ?? {}
  const existingMonthDates = Object.values(series).flatMap((points) =>
    points.filter((point) => isSameMonth(point.date, date)).map((point) => point.date),
  )
  const latestExistingDate = existingMonthDates.toSorted().at(-1)

  if (latestExistingDate && latestExistingDate > date) {
    console.log(`  Kept ${fileName} unchanged for ${getMonthKey(date)}`)
    return
  }

  for (const points of Object.values(series)) {
    for (let i = points.length - 1; i >= 0; i--) {
      if (isSameMonth(points[i].date, date)) {
        points.splice(i, 1)
      }
    }
  }

  for (const item of items) {
    if (!series[item.name]) {
      series[item.name] = []
    }

    const points = series[item.name]
    const dataPoint = { date, count: item.count, pct: item.pct }
    points.push(dataPoint)

    // Keep sorted chronologically
    points.sort((a, b) => a.date.localeCompare(b.date))
  }

  const nonEmptySeries = Object.fromEntries(
    Object.entries(series).filter(([, points]) => points.length > 0),
  )

  const trendSeries: TrendSeries = {
    schema_version: "1.0",
    updated_at: new Date().toISOString(),
    series: nonEmptySeries,
  }

  await writeJSON(filePath, trendSeries)
  console.log(`  Updated ${fileName}`)
}

// ==============================================================================
// llms.txt — markdown index served at the Pages root so LLMs can discover and
// fetch the dataset (https://llmstxt.org convention).
// ==============================================================================

async function updateLlmsTxt(latest: Analysis): Promise<void> {
  const manifest = await readJSON<Manifest>(path.join(INDEXES_DIR, "manifest.json"))
  const runs = manifest?.runs ?? []

  const list = (items: Array<{ name: string; pct: number }>, n: number) =>
    items.slice(0, n).map((i) => `${i.name} (${i.pct}%)`).join(", ")

  const lines = [
    "# HN Job Trends — Data",
    "",
    '> Monthly tech-hiring trends mined from Hacker News "Who is hiring?" threads. Every job posting is classified (role, technologies, experience level, remote policy, compensation) and aggregated per month. All data is served as JSON; this file indexes it for LLMs.',
    "",
    `Latest run: ${latest.date} — ${latest.job_count} jobs analyzed. Generated ${latest.generated_at}.`,
    "",
    "## Latest snapshot",
    "",
    `- Jobs analyzed: ${latest.job_count}`,
    `- Top technologies: ${list(latest.technologies, 8)}`,
    `- Top roles: ${list(latest.roles, 6)}`,
    `- Fully remote: ${latest.remote.fully_remote.pct}%`,
    `- Salary mentioned: ${latest.compensation.salary_mentioned_pct}%`,
    `- AI/ML mentioned: ${latest.ai_ml_mentioned_pct}%`,
    "",
    "## Index files",
    "",
    "- [manifest.json](/indexes/manifest.json): every run with job counts and titles",
    "- [history.json](/indexes/history.json): per-run summary metrics for charting",
    "- [tech-trends.json](/indexes/tech-trends.json): technology counts over time",
    "- [role-trends.json](/indexes/role-trends.json): role counts over time",
    "- [latest.json](/indexes/latest.json): full analysis for the most recent run",
    "",
    "## Per-run data",
    "",
    "Each run exposes `raw.json` (original postings), `classified.json` (per-job labels), and `analysis.json` (aggregated metrics).",
    "",
    ...runs.map((r) => `- [${r.date}](/runs/${r.date}/analysis.json): ${r.job_count} jobs${r.thread_title ? ` — ${r.thread_title}` : ""}`),
    "",
    "## Analysis schema",
    "",
    "`analysis.json` fields: `job_count`; `technologies[]` and `roles[]` as `{name,count,pct}`; `experience_levels[]` as `{level,count,pct}`; `remote` as `{fully_remote,hybrid,onsite_only,not_mentioned}`; `compensation` as `{salary_mentioned_pct,ranges[],equity_mentioned_pct}`; and `ai_ml_mentioned_pct`. All percentages are over `job_count`.",
    "",
  ]

  await fs.writeFile(path.resolve("llms.txt"), lines.join("\n"))
  console.log("  Updated llms.txt")
}

// ==============================================================================
// Public API — called by the orchestrator after analysis completes
// ==============================================================================

export async function updateIndexes(
  analysis: Analysis,
  threadTitle: string | null,
): Promise<void> {
  console.log("Updating indexes...")

  await Promise.all([
    updateLatest(analysis),
    updateManifest(analysis, threadTitle),
    updateHistory(analysis),
    updateTrendSeries("language-trends.json", analysis.languages ?? [], analysis.date),
    updateTrendSeries("tech-trends.json", analysis.technologies, analysis.date),
    updateTrendSeries("role-trends.json", analysis.roles, analysis.date),
  ])

  // After manifest.json is written so the run list is current.
  await updateLlmsTxt(analysis)

  console.log("Indexes updated successfully")
}
