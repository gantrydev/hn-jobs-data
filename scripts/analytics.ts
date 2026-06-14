/**
 * Analytics engine for HN Jobs Data
 *
 * Reads classified.json from all runs and computes:
 *   1. Tech co-occurrence matrix
 *   2. K-means clusters (tech stack archetypes)
 *   3. Association rules (Apriori)
 *   4. Momentum scores (linear regression + exponential smoothing)
 *
 * Outputs to indexes/ for consumption by the frontend.
 *
 * Usage:
 *   node --import tsx/esm scripts/analytics.ts
 */

import fs from "node:fs/promises"
import path from "node:path"

// ==============================================================================
// Types
// ==============================================================================

interface ClassifiedJob {
  id: number
  languages: string[]
  technologies: string[]
  role: string
  experience_level: string
  remote: string
  salary_mentioned: boolean
  salary_band: string | null
  equity_mentioned: boolean
  ai_ml_mentioned: boolean
}

interface ClassifiedData {
  schema_version: string
  date: string
  run_id: string
  jobs: ClassifiedJob[]
  classified_at: string
}

interface CooccurrenceEntry {
  tech: string
  with: string
  count: number
  jaccard: number
}

interface CooccurrenceMatrix {
  schema_version: "1.0"
  generated_at: string
  total_jobs: number
  tech_list: string[]
  matrix: Record<string, Record<string, number>>
  top_pairs: CooccurrenceEntry[]
}

interface ClusterInfo {
  id: number
  label: string
  top_techs: string[]
  top_roles: string[]
  size: number
  pct: number
  avg_salary_mentioned: number
  avg_remote_pct: number
  avg_ai_ml_pct: number
}

interface ClusterResult {
  schema_version: "1.0"
  generated_at: string
  total_jobs: number
  k: number
  clusters: ClusterInfo[]
}

interface AssociationRule {
  antecedent: string[]
  consequent: string[]
  support: number
  confidence: number
  lift: number
  count: number
}

interface AssociationRules {
  schema_version: "1.0"
  generated_at: string
  total_jobs: number
  rules: AssociationRule[]
}

interface MomentumEntry {
  tech: string
  total_count: number
  slope: number // linear regression slope (count/month)
  slope_pct: number // slope as % of average
  trend: "rising" | "stable" | "declining"
  // Per-month data
  series: Array<{ date: string; count: number; pct: number }>
}

interface MomentumResult {
  schema_version: "1.0"
  generated_at: string
  rising: MomentumEntry[]
  declining: MomentumEntry[]
  stable: MomentumEntry[]
}

// ==============================================================================
// Helpers
// ==============================================================================

const INDEXES_DIR = path.resolve("indexes")
const RUNS_DIR = path.resolve("runs")

async function readJSON<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf-8")
  return JSON.parse(content) as T
}

async function writeJSON(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n")
  console.log(`  Wrote ${path.basename(filePath)}`)
}

// ==============================================================================
// Load all classified data
// ==============================================================================

async function loadAllClassified(): Promise<Array<{ date: string; jobs: ClassifiedJob[] }>> {
  const entries = await fs.readdir(RUNS_DIR, { withFileTypes: true })
  const dates = entries
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
    .map((e) => e.name)
    .sort()

  const results: Array<{ date: string; jobs: ClassifiedJob[] }> = []

  for (const date of dates) {
    const filePath = path.join(RUNS_DIR, date, "classified.json")
    try {
      const data = await readJSON<ClassifiedData>(filePath)
      results.push({ date, jobs: data.jobs })
      console.log(`  Loaded ${date}: ${data.jobs.length} jobs`)
    } catch {
      console.log(`  Skipping ${date}: no classified.json`)
    }
  }

  return results
}

// ==============================================================================
// 1. Co-occurrence Matrix
// ==============================================================================

function buildCooccurrenceMatrix(
  allData: Array<{ date: string; jobs: ClassifiedJob[] }>,
): CooccurrenceMatrix {
  // Collect all unique techs
  const techSet = new Set<string>()
  const allJobs: ClassifiedJob[] = []

  for (const { jobs } of allData) {
    for (const job of jobs) {
      if (job.technologies.length > 0) {
        allJobs.push(job)
        for (const t of job.technologies) techSet.add(t)
      }
    }
  }

  const techList = Array.from(techSet).sort()

  // Initialize matrix
  const matrix: Record<string, Record<string, number>> = {}
  for (const a of techList) {
    matrix[a] = {}
    for (const b of techList) {
      matrix[a][b] = 0
    }
  }

  // Count co-occurrences
  for (const job of allJobs) {
    const techs = job.technologies
    for (let i = 0; i < techs.length; i++) {
      for (let j = i + 1; j < techs.length; j++) {
        const a = techs[i]
        const b = techs[j]
        if (matrix[a] && matrix[b]) {
          matrix[a][b]++
          matrix[b][a]++
        }
      }
    }
  }

  // Count single-tech occurrences for Jaccard
  const singleCounts = new Map<string, number>()
  for (const job of allJobs) {
    for (const t of job.technologies) {
      singleCounts.set(t, (singleCounts.get(t) || 0) + 1)
    }
  }

  // Compute top pairs with Jaccard similarity
  const pairs: CooccurrenceEntry[] = []
  for (let i = 0; i < techList.length; i++) {
    for (let j = i + 1; j < techList.length; j++) {
      const a = techList[i]
      const b = techList[j]
      const count = matrix[a][b]
      if (count < 2) continue

      const countA = singleCounts.get(a) || 0
      const countB = singleCounts.get(b) || 0
      const jaccard = countA + countB > count ? count / (countA + countB - count) : 0

      pairs.push({ tech: a, with: b, count, jaccard: Math.round(jaccard * 1000) / 1000 })
    }
  }

  pairs.sort((a, b) => b.count - a.count)

  return {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    total_jobs: allJobs.length,
    tech_list: techList,
    matrix,
    top_pairs: pairs.slice(0, 100),
  }
}

// ==============================================================================
// 2. Tech Stack Clustering
// ==============================================================================

function buildClusters(
  allData: Array<{ date: string; jobs: ClassifiedJob[] }>,
): ClusterResult {
  // Use only the latest run for clustering (snapshot of current landscape)
  const latest = allData[allData.length - 1]
  const jobs = latest.jobs.filter((j) => j.technologies.length > 0)

  // Build tech vocabulary from latest run (technologies only, no languages)
  const techSet = new Set<string>()
  for (const job of jobs) {
    for (const t of job.technologies) techSet.add(t)
  }
  const techList = Array.from(techSet).sort()

  // ── Build co-occurrence adjacency for the latest run ──
  const adj = new Map<string, Map<string, number>>()
  for (const t of techList) adj.set(t, new Map())
  for (const job of jobs) {
    for (let i = 0; i < job.technologies.length; i++) {
      for (let j = i + 1; j < job.technologies.length; j++) {
        const a = job.technologies[i], b = job.technologies[j]
        const ma = adj.get(a)
        const mb = adj.get(b)
        if (!ma || !mb) continue
        ma.set(b, (ma.get(b) ?? 0) + 1)
        mb.set(a, (mb.get(a) ?? 0) + 1)
      }
    }
  }

  // Tech frequencies for Jaccard denominator
  const techFreq = new Map<string, number>()
  for (const job of jobs) {
    for (const t of job.technologies) {
      techFreq.set(t, (techFreq.get(t) ?? 0) + 1)
    }
  }

  // ── Filter noise: only techs with ≥ MIN_OCCURRENCES ──
  const MIN_OCCURRENCES = 3
  const valid = new Set(techList.filter((t) => (techFreq.get(t) ?? 0) >= MIN_OCCURRENCES))

  // ── Greedy tech clustering based on Jaccard similarity ──
  // Start with the most frequent tech, build clusters by adding techs
  // that have high Jaccard similarity with existing cluster members.
  const MIN_JACCARD = 0.15

  // Sort techs by frequency descending
  const sortedTechs = [...valid].sort((a, b) => (techFreq.get(b) ?? 0) - (techFreq.get(a) ?? 0))
  const assigned = new Set<string>()
  const techClusters: string[][] = []

  for (const seed of sortedTechs) {
    if (assigned.has(seed)) continue
    const cluster = [seed]
    assigned.add(seed)

    // Add techs that co-occur strongly with ALL current cluster members
    for (const candidate of sortedTechs) {
      if (assigned.has(candidate)) continue
      let allAbove = true
      let minJac = 1
      for (const member of cluster) {
        const co = adj.get(candidate)?.get(member) ?? 0
        const fa = techFreq.get(candidate) ?? 1
        const fb = techFreq.get(member) ?? 1
        const jac = co / (fa + fb - co)
        if (jac < minJac) minJac = jac
        if (jac < MIN_JACCARD) { allAbove = false; break }
      }
      if (allAbove && cluster.length < 8) {
        cluster.push(candidate)
        assigned.add(candidate)
      }
    }

    if (cluster.length >= 2) {
      techClusters.push(cluster)
    }
  }

  // ── Build ClusterInfo for each tech cluster ──
  const clusters: ClusterInfo[] = []

  for (const techCluster of techClusters) {
    const label = techCluster.slice(0, 3).join(" / ")

    // Count jobs that match ≥2 techs from this cluster
    const matchingJobs = jobs.filter((job) => {
      let m = 0
      for (const t of job.technologies) { if (techCluster.includes(t)) m++ }
      return m >= 2
    })

    const size = matchingJobs.length
    if (size < 2) continue

    const roleCounts = new Map<string, number>()
    for (const job of matchingJobs) {
      roleCounts.set(job.role, (roleCounts.get(job.role) || 0) + 1)
    }

    const topRoles = Array.from(roleCounts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name)

    const avgSalary = matchingJobs.filter((j) => j.salary_mentioned).length / size
    const avgRemote = matchingJobs.filter((j) => j.remote === "fully_remote").length / size
    const avgAiML = matchingJobs.filter((j) => j.ai_ml_mentioned).length / size

    clusters.push({
      id: clusters.length, label,
      top_techs: techCluster, top_roles: topRoles,
      size,
      pct: Math.round((size / jobs.length) * 1000) / 10,
      avg_salary_mentioned: Math.round(avgSalary * 100),
      avg_remote_pct: Math.round(avgRemote * 100),
      avg_ai_ml_pct: Math.round(avgAiML * 100),
    })
  }

  clusters.sort((a, b) => b.size - a.size)
  clusters.forEach((c, i) => (c.id = i))

  const assignedJobs = jobs.filter((j) => {
    for (const cluster of clusters) {
      let m = 0
      for (const t of j.technologies) { if (cluster.top_techs.includes(t)) m++ }
      if (m >= 2) return true
    }
    return false
  })

  return {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    total_jobs: assignedJobs.length,
    k: clusters.length,
    clusters,
  }
}

// ==============================================================================
// 3. Association Rules (Apriori)
// ==============================================================================

function buildAssociationRules(
  allData: Array<{ date: string; jobs: ClassifiedJob[] }>,
): AssociationRules {
  // Use latest run
  const latest = allData[allData.length - 1]
  const jobs = latest.jobs.filter((j) => j.technologies.length >= 2)

  const totalJobs = jobs.length
  const MIN_SUPPORT = 0.03 // 3%
  const MIN_CONFIDENCE = 0.3

  // Trivial pairs: same-ecosystem associations that aren't insightful.
  // Sorted pairs stored as "a|||b".
  const TRIVIAL_PAIRS = new Set([
    // Ruby ecosystem
    ["Rails", "Ruby"].sort().join("|||"),
    ["Sidekiq", "Ruby"].sort().join("|||"),
    ["Sidekiq", "Rails"].sort().join("|||"),
    // Python ecosystem
    ["Django", "Python"].sort().join("|||"),
    ["FastAPI", "Python"].sort().join("|||"),
    // JS ecosystem
    ["Next.js", "React"].sort().join("|||"),
    ["Next.js", "TypeScript"].sort().join("|||"),
    ["Next.js", "Node.js"].sort().join("|||"),
    ["React", "JavaScript"].sort().join("|||"),
    // Java ecosystem
    ["Java", "Spring"].sort().join("|||"),
    ["Java", "Kotlin"].sort().join("|||"),
    // PHP ecosystem
    ["PHP", "Laravel"].sort().join("|||"),
    // Mobile
    ["iOS", "Swift"].sort().join("|||"),
    ["iOS", "React Native"].sort().join("|||"),
    ["Android", "Kotlin"].sort().join("|||"),
    ["Android", "React Native"].sort().join("|||"),
  ])

  // Count single itemsets (support for each tech)
  const itemCounts = new Map<string, number>()
  for (const job of jobs) {
    for (const t of job.technologies) {
      itemCounts.set(t, (itemCounts.get(t) || 0) + 1)
    }
  }

  // Count pairs
  const pairCounts = new Map<string, { count: number }>()
  for (const job of jobs) {
    const techs = job.technologies
    for (let i = 0; i < techs.length; i++) {
      for (let j = i + 1; j < techs.length; j++) {
        const key = [techs[i], techs[j]].sort().join("|||")
        const existing = pairCounts.get(key)
        if (existing) {
          existing.count++
        } else {
          pairCounts.set(key, { count: 1 })
        }
      }
    }
  }

  // Generate rules
  const rules: AssociationRule[] = []

  for (const [key, { count }] of pairCounts) {
    const [a, b] = key.split("|||")

    // Skip trivial same-ecosystem pairs
    if (TRIVIAL_PAIRS.has(key)) continue

    const support = count / totalJobs
    if (support < MIN_SUPPORT) continue

    const countA = itemCounts.get(a) || 0
    const countB = itemCounts.get(b) || 0

    // Emit only the direction with higher lift
    const confAB = count / countA
    const confBA = count / countB
    const expectedIfIndep = (countA / totalJobs) * (countB / totalJobs)
    const lift = support / expectedIfIndep

    if (lift <= 1.2) continue

    if (confAB >= confBA && confAB >= MIN_CONFIDENCE) {
      rules.push({
        antecedent: [a], consequent: [b],
        support: Math.round(support * 1000) / 1000,
        confidence: Math.round(confAB * 1000) / 1000,
        lift: Math.round(lift * 100) / 100,
        count,
      })
    } else if (confBA >= MIN_CONFIDENCE) {
      rules.push({
        antecedent: [b], consequent: [a],
        support: Math.round(support * 1000) / 1000,
        confidence: Math.round(confBA * 1000) / 1000,
        lift: Math.round(lift * 100) / 100,
        count,
      })
    }
  }

  // Sort by lift descending
  rules.sort((a, b) => b.lift - a.lift)

  return {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    total_jobs: totalJobs,
    rules: rules.slice(0, 40),
  }
}

// ==============================================================================
// 4. Momentum Scores
// ==============================================================================

interface TechMonthDatum {
  date: string
  count: number
  totalJobs: number
  pct: number
}

function buildMomentum(allData: Array<{ date: string; jobs: ClassifiedJob[] }>): MomentumResult {
  // Build per-tech per-month time series
  const techMonths = new Map<string, TechMonthDatum[]>()

  for (const { date, jobs } of allData) {
    const totalJobs = jobs.length
    const techCounts = new Map<string, number>()

    for (const job of jobs) {
      for (const t of job.technologies) {
        techCounts.set(t, (techCounts.get(t) || 0) + 1)
      }
    }

    for (const [tech, count] of techCounts) {
      const series = techMonths.get(tech) ?? []
      series.push({
        date,
        count,
        totalJobs,
        pct: Math.round((count / totalJobs) * 1000) / 10,
      })
      techMonths.set(tech, series)
    }
  }

  // Compute linear regression slope for each tech with ≥ 2 data points
  const entries: MomentumEntry[] = []

  for (const [tech, series] of techMonths) {
    if (series.length < 2) continue

    // Convert dates to numeric months from epoch
    const x: number[] = series.map((s) => new Date(s.date).getTime() / (1000 * 60 * 60 * 24 * 30))
    const y: number[] = series.map((s) => s.pct)

    const n = x.length
    const sumX = x.reduce((a, b) => a + b, 0)
    const sumY = y.reduce((a, b) => a + b, 0)
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0)
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0)

    const denominator = n * sumX2 - sumX * sumX
    const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0

    const avgY = sumY / n
    const slopePct = avgY !== 0 ? (slope / avgY) * 100 : 0

    // Determine trend
    let trend: "rising" | "stable" | "declining"
    if (slopePct > 5) trend = "rising"
    else if (slopePct < -5) trend = "declining"
    else trend = "stable"

    entries.push({
      tech,
      total_count: series.reduce((s, d) => s + d.count, 0),
      slope: Math.round(slope * 1000) / 1000,
      slope_pct: Math.round(slopePct * 10) / 10,
      trend,
      series,
    })
  }

  const rising = entries
    .filter((e) => e.trend === "rising")
    .sort((a, b) => b.slope_pct - a.slope_pct)

  const declining = entries
    .filter((e) => e.trend === "declining")
    .sort((a, b) => a.slope_pct - b.slope_pct)

  const stable = entries
    .filter((e) => e.trend === "stable")
    .sort((a, b) => b.slope_pct - a.slope_pct)

  return {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    rising,
    declining,
    stable,
  }
}

// ==============================================================================
// Public API
// ==============================================================================

export async function runAnalytics(): Promise<void> {
  console.log("\n📊 Running analytics...")

  const allData = await loadAllClassified()
  if (allData.length === 0) {
    console.warn("⚠ No classified data found — skipping analytics.")
    return
  }

  // 1. Co-occurrence
  const cooccurrence = buildCooccurrenceMatrix(allData)
  await writeJSON(path.join(INDEXES_DIR, "tech-cooccurrence.json"), cooccurrence)
  console.log(`  Co-occurrence: ${cooccurrence.top_pairs.length} significant pairs`)

  // 2. Clusters
  const clusters = buildClusters(allData)
  await writeJSON(path.join(INDEXES_DIR, "tech-clusters.json"), clusters)
  for (const c of clusters.clusters) {
    console.log(`  Cluster ${c.id}: ${c.label} (${c.size} jobs, ${c.pct}%)`)
  }

  // 3. Association rules
  const associations = buildAssociationRules(allData)
  await writeJSON(path.join(INDEXES_DIR, "tech-associations.json"), associations)
  console.log(`  Associations: ${associations.rules.length} rules`)

  // 4. Momentum
  const momentum = buildMomentum(allData)
  await writeJSON(path.join(INDEXES_DIR, "tech-momentum.json"), momentum)
  console.log(
    `  Momentum: ${momentum.rising.length} rising, ${momentum.stable.length} stable, ${momentum.declining.length} declining`,
  )

  // 5. Combined insights (lightweight for quick frontend loading)
  const insights = {
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    top_pairs: cooccurrence.top_pairs.slice(0, 10),
    clusters: clusters.clusters.map((c) => ({
      label: c.label,
      top_techs: c.top_techs.slice(0, 5),
      pct: c.pct,
    })),
    top_associations: associations.rules.slice(0, 10).map((r) => ({
      antecedent: r.antecedent,
      consequent: r.consequent,
      confidence: r.confidence,
      lift: r.lift,
    })),
    momentum_summary: {
      top_rising: momentum.rising.slice(0, 5).map((e) => ({ tech: e.tech, slope_pct: e.slope_pct })),
      top_declining: momentum.declining.slice(0, 5).map((e) => ({ tech: e.tech, slope_pct: e.slope_pct })),
    },
  }
  await writeJSON(path.join(INDEXES_DIR, "insights.json"), insights)

  console.log("\n✅ Analytics complete\n")
}

// Allow running directly: node --import tsx/esm scripts/analytics.ts
const isMainModule = process.argv[1]?.includes("analytics")
if (isMainModule) {
  runAnalytics().catch((err) => {
    console.error("Analytics failed:", err)
    process.exit(1)
  })
}
