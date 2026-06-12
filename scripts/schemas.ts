import * as z from "zod/v4"

// ==============================================================================
// Shared primitives
// ==============================================================================

const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
const isoTimestampSchema = z.string().trim().datetime()
const pctSchema = z.number().min(0).max(100)
const countPctSchema = z.object({ count: z.int().min(0), pct: pctSchema })

export const SALARY_BANDS = ["<$100k", "$100k-$150k", "$150k-$200k", "$200k+"] as const
export type SalaryBand = (typeof SALARY_BANDS)[number]

export const TECHNOLOGY_TAXONOMY = {
  Languages: [
    "TypeScript",
    "JavaScript",
    "Python",
    "Go",
    "Rust",
    "Java",
    "Kotlin",
    "Swift",
    "C++",
    "C#",
    "C",
    "Ruby",
    "PHP",
    "Scala",
    "Elixir",
    "Dart",
    "R",
    "OCaml",
  ],
  Frontend: ["React", "Next.js", "Vue", "Angular", "Svelte", "Ember.js", "CSS", "Redux"],
  Backend: [
    "Node.js",
    "Django",
    "FastAPI",
    "Rails",
    "Spring",
    "Laravel",
    "GraphQL",
    "gRPC",
    "Express",
    "Flask",
    "NestJS",
    "WebSockets",
    "WebRTC",
  ],
  Databases: [
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "Redis",
    "Elasticsearch",
    "Cassandra",
    "SQLite",
    "Snowflake",
    "ClickHouse",
    "SQL",
    "SQL Server",
    "Supabase",
    "Neo4j",
    "Firestore",
  ],
  Cloud: ["AWS", "GCP", "Azure", "Cloudflare", "Vercel", "Firebase", "S3"],
  "Infra/DevOps": [
    "Kubernetes",
    "Docker",
    "Terraform",
    "GitHub Actions",
    "Linux",
    "Jenkins",
    "Git",
    "Nix",
    "eBPF",
  ],
  Messaging: ["Kafka", "RabbitMQ", "Pub/Sub", "SQS"],
  "AI/ML": [
    "PyTorch",
    "TensorFlow",
    "LangChain",
    "OpenAI API",
    "Anthropic API",
    "Gemini API",
    "Hugging Face",
    "CUDA",
    "Spark",
    "Airflow",
    "MCP",
  ],
  Mobile: ["iOS", "Android", "React Native", "Flutter"],
  Robotics: ["ROS"],
  Runtime: ["WebAssembly"],
} as const

export const TECHNOLOGY_NAMES = Object.values(TECHNOLOGY_TAXONOMY).flat() as [
  (typeof TECHNOLOGY_TAXONOMY)[keyof typeof TECHNOLOGY_TAXONOMY][number],
  ...(typeof TECHNOLOGY_TAXONOMY)[keyof typeof TECHNOLOGY_TAXONOMY][number][],
]
export type Technology = (typeof TECHNOLOGY_NAMES)[number]

export const ROLE_NAMES = [
  "Software Engineer",
  "Senior Software Engineer",
  "Staff Engineer",
  "Principal Engineer",
  "Engineering Manager",
  "Full Stack Engineer",
  "Backend Engineer",
  "Frontend Engineer",
  "Mobile Engineer",
  "ML Engineer",
  "AI Engineer",
  "Data Scientist",
  "Data Engineer",
  "DevOps / SRE",
  "Product Manager",
  "Designer",
  "Other",
] as const
export type Role = (typeof ROLE_NAMES)[number]

const TECHNOLOGY_ALIASES: Record<string, Technology> = {
  "claude api": "Anthropic API",
  "gemini api": "Gemini API",
  "github actions": "GitHub Actions",
  golang: "Go",
  "google cloud": "GCP",
  "ruby on rails": "Rails",
  "vue.js": "Vue",
}

const ROLE_ALIASES: Record<string, Role> = {
  "data analyst": "Data Scientist",
  "founding engineer": "Software Engineer",
  "infrastructure engineer": "DevOps / SRE",
  "product engineer": "Software Engineer",
  "senior backend engineer": "Backend Engineer",
  "senior full stack engineer": "Full Stack Engineer",
}

const SALARY_BAND_ALIASES: Record<string, SalaryBand> = {
  "<$100k": "<$100k",
  "<100k": "<$100k",
  "$0-$100k": "<$100k",
  "less-than-100k": "<$100k",
  under_100k: "<$100k",
  under$100k: "<$100k",
  "under $100k": "<$100k",
  "100k-$150k": "$100k-$150k",
  "100k-150k": "$100k-$150k",
  "$100k-$150k": "$100k-$150k",
  "$100k-150k": "$100k-$150k",
  "150k-$200k": "$150k-$200k",
  "150k-200k": "$150k-$200k",
  "$150k-$200k": "$150k-$200k",
  "$150k-200k": "$150k-$200k",
  "200k+": "$200k+",
  "$200k+": "$200k+",
  ">$200k": "$200k+",
}

function salaryBandForAmount(amountInThousands: number): SalaryBand {
  if (amountInThousands < 100) return "<$100k"
  if (amountInThousands < 150) return "$100k-$150k"
  if (amountInThousands < 200) return "$150k-$200k"
  return "$200k+"
}

function normalizeSalaryBandKey(value: string): string {
  return value.trim().toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ")
}

function parseUsdSalaryBand(value: string): SalaryBand | null {
  const key = normalizeSalaryBandKey(value)
  if (/[€£]/.test(key)) return null
  if (/\b(non-usd|not available|not specified|skipping)\b/.test(key)) return null

  const amounts = [...key.matchAll(/\$?\s*(\d+(?:\.\d+)?)(?:\s*k)?/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite)
    .map((amount) => (amount >= 1000 ? amount / 1000 : amount))

  if (amounts.length === 0) return null
  const representativeAmount = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length
  return salaryBandForAmount(representativeAmount)
}

export function normalizeSalaryBand(value: unknown): SalaryBand | null {
  if (typeof value !== "string") return null
  const key = normalizeSalaryBandKey(value)
  return SALARY_BAND_ALIASES[key] ?? parseUsdSalaryBand(value)
}

function normalizeTaxonomyKey(value: string): string {
  return value.trim().toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ")
}

export function normalizeTechnology(value: unknown): Technology | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  const canonical = TECHNOLOGY_NAMES.find(
    (technology) => technology.toLowerCase() === trimmed.toLowerCase(),
  )
  if (canonical) return canonical
  return TECHNOLOGY_ALIASES[normalizeTaxonomyKey(trimmed)] ?? null
}

export function normalizeRole(value: unknown): Role | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  const canonical = ROLE_NAMES.find((role) => role.toLowerCase() === trimmed.toLowerCase())
  if (canonical) return canonical
  return ROLE_ALIASES[normalizeTaxonomyKey(trimmed)] ?? null
}

const SalaryBandValueSchema = z.enum(SALARY_BANDS)
const StrictSalaryBandValueSchema = z.preprocess(
  (value) => normalizeSalaryBand(value) ?? value,
  SalaryBandValueSchema,
)
const NullableSalaryBandValueSchema = z.preprocess((value) => {
  if (value === null || value === undefined) return null
  return normalizeSalaryBand(value)
}, SalaryBandValueSchema.nullable())
const TechnologyValueSchema = z.enum(TECHNOLOGY_NAMES)
const TechnologyListSchema = z.preprocess((value) => {
  if (!Array.isArray(value)) return value
  return [
    ...new Set(
      value.flatMap((item) => {
        const normalized = normalizeTechnology(item)
        return normalized ? [normalized] : []
      }),
    ),
  ]
}, z.array(TechnologyValueSchema))
const RoleValueSchema = z.preprocess((value) => normalizeRole(value) ?? value, z.enum(ROLE_NAMES))

// ==============================================================================
// raw.json — fetched job data before LLM analysis
// ==============================================================================

export const RawJobSchema = z.object({
  id: z.int(),
  source: z.enum(["who_is_hiring", "direct"]),
  by: z.string().trim(),
  time: z.int(),
  text: z.string().trim(),
})

export const RawDataSchema = z.object({
  schema_version: z.literal("1.0"),
  date: dateStringSchema,
  run_id: z.string().trim(),
  sources: z.object({
    who_is_hiring_thread_id: z.int().nullable(),
    who_is_hiring_thread_title: z.string().trim().nullable(),
    direct_jobstories_count: z.int(),
  }),
  jobs: z.array(RawJobSchema),
  fetched_at: isoTimestampSchema,
  total_jobs: z.int(),
})

// ==============================================================================
// analysis.json — LLM-generated structured summary
// ==============================================================================

const NamedCountSchema = z.object({
  name: z.string().trim(),
  count: z.int().min(0),
  pct: pctSchema,
})

const TechnologyCountSchema = NamedCountSchema.extend({
  name: TechnologyValueSchema,
})

const RoleCountSchema = NamedCountSchema.extend({
  name: RoleValueSchema,
})

const SalaryBandSchema = z.object({
  band: StrictSalaryBandValueSchema,
  count: z.int().min(0),
})

const ExperienceLevelSchema = z.object({
  level: z.enum(["Senior", "Mid", "Junior", "Not specified"]),
  count: z.int().min(0),
  pct: pctSchema,
})

export const ClassifiedJobSchema = z
  .object({
    id: z.int(),
    technologies: TechnologyListSchema,
    role: RoleValueSchema,
    experience_level: z.enum(["Senior", "Mid", "Junior", "Not specified"]),
    remote: z.enum(["fully_remote", "hybrid", "onsite_only", "not_mentioned"]),
    salary_mentioned: z.boolean(),
    salary_band: NullableSalaryBandValueSchema,
    equity_mentioned: z.boolean(),
    ai_ml_mentioned: z.boolean(),
  })
  .superRefine((job, ctx) => {
    if (job.salary_mentioned && job.salary_band === null) {
      ctx.addIssue({
        code: "custom",
        path: ["salary_band"],
        message: "salary_band is required when salary_mentioned is true",
      })
    }

    if (!job.salary_mentioned && job.salary_band !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["salary_band"],
        message: "salary_band must be null when salary_mentioned is false",
      })
    }
  })

const BatchClassifiedJobSchema = ClassifiedJobSchema.extend({
  is_job: z.boolean(),
})

export const BatchResponseSchema = z.object({
  jobs: z.array(BatchClassifiedJobSchema),
})

// The full analysis shape written to disk (with metadata and computed percentages)
export const AnalysisSchema = z.object({
  schema_version: z.literal("1.0"),
  date: dateStringSchema,
  run_id: z.string().trim(),
  job_count: z.int(),
  technologies: z.array(TechnologyCountSchema),
  roles: z.array(RoleCountSchema),
  compensation: z.object({
    salary_mentioned_count: z.int().min(0),
    salary_mentioned_pct: pctSchema,
    ranges: z.array(SalaryBandSchema),
    equity_mentioned_count: z.int().min(0),
    equity_mentioned_pct: pctSchema,
  }),
  remote: z.object({
    fully_remote: countPctSchema,
    hybrid: countPctSchema,
    onsite_only: countPctSchema,
    not_mentioned: countPctSchema,
  }),
  experience_levels: z.array(ExperienceLevelSchema),
  ai_ml_mentioned_pct: pctSchema,
  generated_at: isoTimestampSchema,
})

// ==============================================================================
// classified.json — per-job LLM classifications
// ==============================================================================

export const ClassifiedDataSchema = z.object({
  schema_version: z.literal("1.0"),
  date: z.string().trim(),
  run_id: z.string().trim(),
  jobs: z.array(ClassifiedJobSchema),
  classified_at: z.string().trim().datetime(),
})

// ==============================================================================
// Index files — manifest, history, tech/role trends
// ==============================================================================

export const ManifestRunSchema = z.object({
  run_id: z.string().trim(),
  date: dateStringSchema,
  type: z.enum(["main", "refresh"]),
  job_count: z.int(),
  thread_title: z.string().trim().nullable(),
})

export const ManifestSchema = z.object({
  schema_version: z.literal("1.0"),
  runs: z.array(ManifestRunSchema),
  latest_run_id: z.string().trim(),
  updated_at: isoTimestampSchema,
})

export const HistoryRunSchema = z.object({
  date: dateStringSchema,
  job_count: z.int(),
  top_techs: z.array(z.string().trim()),
  top_roles: z.array(z.string().trim()),
  remote_pct: pctSchema,
  salary_mentioned_pct: pctSchema,
  ai_ml_mentioned_pct: pctSchema,
})

export const HistorySchema = z.object({
  schema_version: z.literal("1.0"),
  runs: z.array(HistoryRunSchema),
})

const TrendDataPointSchema = z.object({
  date: dateStringSchema,
  count: z.int().min(0),
  pct: pctSchema,
})

export const TrendSeriesSchema = z.object({
  schema_version: z.literal("1.0"),
  updated_at: isoTimestampSchema,
  series: z.record(z.string().trim(), z.array(TrendDataPointSchema)),
})

// ==============================================================================
// Inferred types
// ==============================================================================

export type RawJob = z.infer<typeof RawJobSchema>
export type RawData = z.infer<typeof RawDataSchema>
export type BatchResponse = z.infer<typeof BatchResponseSchema>
export type Analysis = z.infer<typeof AnalysisSchema>
export type ClassifiedJob = z.infer<typeof ClassifiedJobSchema>
export type ClassifiedData = z.infer<typeof ClassifiedDataSchema>
export type ManifestRun = z.infer<typeof ManifestRunSchema>
export type Manifest = z.infer<typeof ManifestSchema>
export type HistoryRun = z.infer<typeof HistoryRunSchema>
export type History = z.infer<typeof HistorySchema>
export type TrendSeries = z.infer<typeof TrendSeriesSchema>
