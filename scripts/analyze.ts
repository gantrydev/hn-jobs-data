import * as z from "zod/v4"
import { BatchResponseSchema, ClassifiedJobSchema, SALARY_BANDS, type Analysis, type BatchResponse, type ClassifiedJob, type RawData, type RawJob, type SalaryBand } from "./schemas.js"

// ==============================================================================
// OpenRouter API
// ==============================================================================

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
const DEFAULT_MODEL = "deepseek/deepseek-v4-flash:nitro"
const MODEL = process.env.MODEL ?? DEFAULT_MODEL
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT ?? "8", 10)

// Configurable batch size — smaller batches = better accuracy + lower latency,
// but more API calls. 10 is a good default for ~200 job postings.
const JOBS_PER_BATCH = parseInt(process.env.JOBS_PER_BATCH ?? "10", 10)

// The prompt focuses on classification rules only — output format is enforced
// via structured output (response_format), not prompt instructions.
const SYSTEM_PROMPT = `You are a data analyst specializing in tech job market trends.

You will be given a batch of comments from a Hacker News "Who is hiring?" thread.
Each comment has a numeric ID. Most are job postings from employers, but some are
not (meta-commentary, "Who wants to be hired?" / freelancer-seeking posts, questions,
or replies). Classify each comment and return a "jobs" array with one entry per input.

## Technology Taxonomy

Only use the following technology names. Map all variants to the canonical name.
Do not invent new entries. If a technology is not in this list, skip it.

Languages:     TypeScript, JavaScript, Python, Go, Rust, Java, Kotlin, Swift, C++, C#, Ruby, PHP, Scala, Elixir
Frontend:      React, Next.js, Vue, Angular, Svelte
Backend:       Node.js, Django, FastAPI, Rails, Spring, Laravel, GraphQL, gRPC
Databases:     PostgreSQL, MySQL, MongoDB, Redis, Elasticsearch, Cassandra, SQLite
Cloud:         AWS, GCP, Azure, Cloudflare
Infra/DevOps:  Kubernetes, Docker, Terraform, GitHub Actions
Messaging:     Kafka, RabbitMQ, Pub/Sub, SQS
AI/ML:         PyTorch, TensorFlow, LangChain, OpenAI API, Hugging Face
Mobile:        iOS, Android, React Native, Flutter

## Role Taxonomy

Only use the following role names. Normalize all variants to the closest match.

Software Engineer, Senior Software Engineer, Staff Engineer, Principal Engineer,
Engineering Manager, Full Stack Engineer, Backend Engineer, Frontend Engineer,
Mobile Engineer, ML Engineer, AI Engineer, Data Scientist, Data Engineer,
DevOps / SRE, Product Manager, Designer, Other

## Experience Level Rules

- "Senior"        = mentions "senior", "sr.", "5+ years", "7+ years", or similar
- "Mid"           = mentions "mid-level", "3+ years", "3-5 years"
- "Junior"        = mentions "junior", "jr.", "new grad", "0-2 years", "entry level"
- "Not specified" = no clear indication

## Compensation Rules

- Count a job as "salary mentioned" only if a dollar figure or range appears
- salary_band must be exactly one of: ${SALARY_BANDS.join(", ")}
- salary_band should be null when salary_mentioned is false
- Count equity as mentioned only if "equity", "options", "RSUs", or "stock" appears

## Remote Rules

- "fully_remote"   = explicitly states remote with no location requirement
- "hybrid"         = mentions hybrid, partial remote, or specific days in-office
- "onsite_only"    = requires specific location with no remote option stated
- "not_mentioned"  = no work arrangement information

## Job vs non-job (is_job)

Set is_job = true for any comment where an employer or team is advertising a position
they want to fill. Be inclusive — this covers:
- full-time, part-time, contract, consulting, freelance, and internship roles
- academic, faculty, and research positions
- early-stage or founding-team engineering roles at a startup
- posts that describe the company first and then list the roles being hired for
- a pipe-delimited header like "Company | Role | Location | REMOTE" — the standard
  format in these threads — is ALWAYS a job, even if terse or listing several roles
- any explicit hiring language: "we're hiring", "we are looking for", "join our team",
  "now hiring", or a contact-to-apply email/link

Set is_job = false ONLY when the comment is not itself a hiring listing:
- meta-commentary, questions, or discussion about the thread or job market
- "Who wants to be hired?" or candidates advertising themselves for work
- replies from applicants or third parties ("I applied...", "I don't work there but...")
- shared links, aggregators, or tooling
- requests to the poster or moderators (e.g. asking to add a tag)
- co-founder searches that offer only equity with no salaried role

When in doubt about a comment that names a company and a role, prefer is_job = true.
When is_job is false, still fill the other fields with best-effort defaults
(empty technologies, role "Other", "Not specified", "not_mentioned", false/null).

## Per-job classification ("jobs" array)

For each comment, return an object with:
- id: the numeric HN item ID provided in the input
- is_job: boolean per the rules above
- technologies: array of canonical technology names found in this job
- role: single closest role from the taxonomy
- experience_level: one of "Senior", "Mid", "Junior", "Not specified"
- remote: one of "fully_remote", "hybrid", "onsite_only", "not_mentioned"
- salary_mentioned: boolean
- salary_band: one of ${SALARY_BANDS.join(", ")} if salary_mentioned is true, null otherwise
- equity_mentioned: boolean
- ai_ml_mentioned: boolean (any mention of AI, ML, LLM, or related terms)

## Important

- Return exactly one entry in the "jobs" array per input comment, using the provided ID
- Set is_job correctly — non-postings must not be counted as jobs
- Use only the canonical technology and role names listed above`

// Convert the Zod schema to JSON Schema once — passed to OpenRouter as structured
// output so the model is constrained to return valid JSON matching our schema.
const batchJsonSchema = z.toJSONSchema(BatchResponseSchema)

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
  usage?: {
    completion_tokens?: number
  }
}

// ==============================================================================
// Single batch API call with retry
// ==============================================================================

async function callOpenRouter(jobs: RawJob[], label: string): Promise<BatchResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error("OPENROUTER_API_KEY environment variable is not set")

  const jobTexts = jobs.map((job) => `--- Job ID: ${job.id} ---\n${job.text}`).join("\n\n")
  const userMessage = `Here are ${jobs.length} comments from a "Who is hiring?" thread. Classify each one individually using the provided ID, setting is_job=false for any comment that is not an employer's job posting.\n\n${jobTexts}`

  let lastError: Error | null = null
  let best: BatchResponse | null = null

  // First attempt is deterministic; retries raise temperature so a model that
  // botched structured output (truncated JSON, or dropped some postings) actually
  // re-rolls instead of replaying the same bad response.
  const MAX_ATTEMPTS = 4
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      if (attempt > 1) console.log(`    [${label}] retry ${attempt}/${MAX_ATTEMPTS} — ${lastError?.message}`)

      const started = Date.now()
      const res: Response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          // Structured output — model is constrained to return valid JSON
          // matching our BatchResponseSchema. No code fence stripping needed.
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "batch_response",
              schema: batchJsonSchema,
            },
          },
          temperature: attempt === 1 ? 0 : 0.4,
          max_tokens: 32768,
          // Pure extraction task — skip chain-of-thought, which was ~70% of the
          // output tokens (and thus the latency). Override with REASONING=1.
          reasoning: { enabled: process.env.REASONING === "1" },
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
      }

      // Measure after the body is read: the model streams the JSON as it
      // generates, so res.json() — not fetch() — is where the time goes.
      const data = (await res.json()) as OpenRouterResponse
      const elapsed = Date.now() - started
      const content = data.choices[0]?.message?.content
      if (!content) throw new Error("empty response")

      const parsed = BatchResponseSchema.parse(JSON.parse(content))
      const returnedIds = new Set(parsed.jobs.map((j) => j.id))
      const missing = jobs.filter((j) => !returnedIds.has(j.id))
      if (missing.length === 0) {
        const tok = data.usage?.completion_tokens
        const tps = tok ? `, ${Math.round(tok / (elapsed / 1000))}tps` : ""
        console.log(`    [${label}] ${parsed.jobs.length}/${jobs.length} in ${elapsed}ms${tok ? `, ${tok}tok${tps}` : ""}${attempt > 1 ? ` (attempt ${attempt})` : ""}`)
        return parsed
      }

      // Model dropped some postings — keep the most complete attempt and re-roll.
      if (!best || parsed.jobs.length > best.jobs.length) best = parsed
      throw new Error(`returned ${parsed.jobs.length}/${jobs.length}, missing ${missing.length} id(s) after ${elapsed}ms`)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  if (best) {
    console.warn(`    [${label}] ⚠ incomplete after ${MAX_ATTEMPTS} attempts: ${best.jobs.length}/${jobs.length} classified`)
    return best
  }

  throw new Error(`[${label}] failed after ${MAX_ATTEMPTS} attempts: ${lastError?.message}`)
}

// ==============================================================================
// Aggregation — merge batch results and compute percentages
// ==============================================================================

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function toPct(count: number, total: number): number {
  return total === 0 ? 0 : round1((count / total) * 100)
}

function aggregate(jobs: ClassifiedJob[]): Omit<Analysis, "schema_version" | "date" | "run_id" | "job_count" | "generated_at"> {
  const totalJobs = jobs.length

  const techMap = new Map<string, number>()
  const roleMap = new Map<string, number>()
  const bandMap = new Map<SalaryBand, number>()
  const levelMap = new Map<string, number>()

  let salaryCount = 0
  let equityCount = 0
  let remoteFullyRemote = 0
  let remoteHybrid = 0
  let remoteOnsite = 0
  let remoteNotMentioned = 0
  let aiMlCount = 0

  for (const job of jobs) {
    for (const t of job.technologies) {
      techMap.set(t, (techMap.get(t) ?? 0) + 1)
    }
    roleMap.set(job.role, (roleMap.get(job.role) ?? 0) + 1)
    levelMap.set(job.experience_level, (levelMap.get(job.experience_level) ?? 0) + 1)

    if (job.salary_mentioned) salaryCount += 1
    if (job.salary_band) bandMap.set(job.salary_band, (bandMap.get(job.salary_band) ?? 0) + 1)
    if (job.equity_mentioned) equityCount += 1
    if (job.ai_ml_mentioned) aiMlCount += 1

    if (job.remote === "fully_remote") remoteFullyRemote += 1
    else if (job.remote === "hybrid") remoteHybrid += 1
    else if (job.remote === "onsite_only") remoteOnsite += 1
    else remoteNotMentioned += 1
  }

  // Convert maps to sorted arrays with percentages
  const mapToSorted = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([name, count]) => ({ name, count, pct: toPct(count, totalJobs) }))
      .sort((a, b) => b.count - a.count)

  const levels = (["Senior", "Mid", "Junior", "Not specified"] as const)
    .map((level) => ({
      level,
      count: levelMap.get(level) ?? 0,
      pct: toPct(levelMap.get(level) ?? 0, totalJobs),
    }))
    .sort((a, b) => b.count - a.count)

  const ranges = [...bandMap.entries()]
    .map(([band, count]) => ({ band, count }))
    .sort((a, b) => b.count - a.count)

  return {
    technologies: mapToSorted(techMap),
    roles: mapToSorted(roleMap),
    compensation: {
      salary_mentioned_count: salaryCount,
      salary_mentioned_pct: toPct(salaryCount, totalJobs),
      ranges,
      equity_mentioned_count: equityCount,
      equity_mentioned_pct: toPct(equityCount, totalJobs),
    },
    remote: {
      fully_remote: { count: remoteFullyRemote, pct: toPct(remoteFullyRemote, totalJobs) },
      hybrid: { count: remoteHybrid, pct: toPct(remoteHybrid, totalJobs) },
      onsite_only: { count: remoteOnsite, pct: toPct(remoteOnsite, totalJobs) },
      not_mentioned: { count: remoteNotMentioned, pct: toPct(remoteNotMentioned, totalJobs) },
    },
    experience_levels: levels,
    ai_ml_mentioned_pct: toPct(aiMlCount, totalJobs),
  }
}

// ==============================================================================
// Bounded-concurrency pool — keeps `limit` calls in flight at all times, so a
// slow batch never stalls the others (unlike a fixed-wave barrier).
// ==============================================================================

async function runPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// ==============================================================================
// Main entry point — batch jobs, run in parallel, aggregate
// ==============================================================================

export interface AnalyzeResult {
  analysis: Analysis
  classifiedJobs: ClassifiedJob[]
}

export async function analyzeJobs(raw: RawData): Promise<AnalyzeResult> {
  // Split jobs into batches of JOBS_PER_BATCH
  const batches: RawJob[][] = []
  for (let i = 0; i < raw.jobs.length; i += JOBS_PER_BATCH) {
    batches.push(raw.jobs.slice(i, i + JOBS_PER_BATCH))
  }

  console.log(`Analyzing ${raw.total_jobs} jobs via OpenRouter (${MODEL})...`)
  console.log(`  ${batches.length} batches of up to ${JOBS_PER_BATCH} jobs, ${MAX_CONCURRENT} concurrent`)

  // Process batches with a bounded-concurrency pool
  const startedAll = Date.now()
  const results = await runPool(batches, MAX_CONCURRENT, (batch, i) =>
    callOpenRouter(batch, `batch ${i + 1}/${batches.length}`),
  )

  const modelJobs = results.flatMap((batch) => batch.jobs)
  console.log(`  Model returned ${modelJobs.length}/${raw.total_jobs} classifications in ${((Date.now() - startedAll) / 1000).toFixed(1)}s`)
  if (modelJobs.length !== raw.total_jobs) {
    console.warn(`  ⚠ coverage gap: ${raw.total_jobs - modelJobs.length} comment(s) never classified`)
  }

  const classifiedJobs: ClassifiedJob[] = modelJobs
    .filter((job) => job.is_job)
    .map((job) => ClassifiedJobSchema.parse(job))
  const dropped = modelJobs.length - classifiedJobs.length
  if (dropped > 0) console.log(`  Filtered ${dropped} non-job comment(s) (is_job=false)`)

  const aggregated = aggregate(classifiedJobs)

  console.log(`  Analysis complete: ${aggregated.technologies.length} technologies, ${aggregated.roles.length} roles, ${classifiedJobs.length} jobs classified`)

  const analysis: Analysis = {
    schema_version: "1.0",
    date: raw.date,
    run_id: raw.run_id,
    job_count: classifiedJobs.length,
    ...aggregated,
    generated_at: new Date().toISOString(),
  }

  return { analysis, classifiedJobs }
}
