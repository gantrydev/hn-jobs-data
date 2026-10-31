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
export const TAXONOMY_VERSION = "2026-10-31"

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
    "Bash",
    "Solidity",
    "Clojure",
    "Haskell",
    "Erlang",
    "Julia",
    "Objective-C",
    "MATLAB",
    "ClojureScript",
    "Lua",
    "Zig",
    "F#",
  ],
  Frontend: [
    "React",
    "Next.js",
    "Vue",
    "Angular",
    "Svelte",
    "Ember.js",
    "CSS",
    "Redux",
    "HTML",
    "Tailwind CSS",
    "shadcn/ui",
    "TanStack",
    "SvelteKit",
    "Astro",
    "Three.js",
    "HTMX",
    "Nuxt",
    "Remix",
    "SolidJS",
    "Hotwire",
    "Stimulus",
    "Zustand",
    "Alpine.js",
    "React Router",
    "Hotwire Turbo",
  ],
  Backend: [
    "Node.js",
    "Django",
    "FastAPI",
    "Rails",
    "Spring",
    "Laravel",
    "Express",
    "Flask",
    "NestJS",
    "Phoenix",
    "Prisma",
    "Drizzle",
    "Pydantic",
    "Fastify",
    "Hono",
    "tRPC",
    "SQLAlchemy",
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
    "SQL Server",
    "Supabase",
    "Neo4j",
    "Firestore",
    "BigQuery",
    "DuckDB",
    "DynamoDB",
    "PostGIS",
    "Redshift",
    "OpenSearch",
    "Pinecone",
    "TimescaleDB",
    "Trino",
    "pgvector",
    "Chroma",
    "InfluxDB",
    "ScyllaDB",
    "CockroachDB",
    "Neon",
    "PlanetScale",
    "Convex",
    "Cosmos DB",
    "Qdrant",
    "Weaviate",
  ],
  "Cloud/Hosting": [
    "AWS",
    "GCP",
    "Azure",
    "Cloudflare",
    "Vercel",
    "Firebase",
    "Modal",
    "DigitalOcean",
    "Fly.io",
    "Railway",
    "Heroku",
    "Netlify",
    "Scaleway",
    "CoreWeave",
    "Hetzner",
  ],
  "Cloud Services": [
    "S3",
    "AWS Lambda",
    "AWS ECS",
    "AWS EKS",
    "AWS Fargate",
    "AWS EC2",
    "AWS RDS",
    "Cloud Run",
    "Cloudflare Workers",
    "Cloudflare R2",
  ],
  "Infra/DevOps": [
    "Kubernetes",
    "Docker",
    "Terraform",
    "Linux",
    "Nix",
    "eBPF",
    "Helm",
    "Pulumi",
    "Ansible",
    "OpenTofu",
    "Argo CD",
    "Flux",
    "OpenStack",
    "Nomad",
    "Vault",
    "NGINX",
    "Istio",
    "Linkerd",
    "AWS CDK",
    "CloudFormation",
    "Terragrunt",
  ],
  "CI/CD": ["GitHub Actions", "Jenkins", "GitLab CI", "CircleCI", "Buildkite", "Azure DevOps"],
  Messaging: ["Kafka", "RabbitMQ", "Pub/Sub", "SQS", "MQTT", "NATS"],
  "APIs/Protocols": ["GraphQL", "gRPC", "WebSockets", "WebRTC"],
  "Query Languages": ["SQL"],
  "Workflow Orchestration": ["Temporal", "Celery", "Sidekiq"],
  "Data Engineering": [
    "Spark",
    "Airflow",
    "dbt",
    "Dagster",
    "Databricks",
    "Pandas",
    "NumPy",
    "Polars",
    "SciPy",
    "Iceberg",
    "Prefect",
    "Fivetran",
    "Metabase",
    "Flink",
    "Power BI",
    "Superset",
    "Looker",
  ],
  "AI/ML": [
    "PyTorch",
    "TensorFlow",
    "LangChain",
    "OpenAI API",
    "Anthropic API",
    "Gemini API",
    "Hugging Face",
    "CUDA",
    "MCP",
    "LangGraph",
    "Ray",
    "LlamaIndex",
    "scikit-learn",
    "vLLM",
    "JAX",
    "TensorRT",
    "ONNX",
    "Pydantic AI",
    "Semantic Kernel",
    "MLflow",
    "Triton",
    "FAISS",
    "OpenCV",
    "Hugging Face Transformers",
    "OpenAI Agents SDK",
  ],
  Observability: [
    "Grafana",
    "Datadog",
    "Prometheus",
    "OpenTelemetry",
    "Sentry",
    "New Relic",
    "Honeycomb",
    "Splunk",
    "Loki",
    "Langfuse",
    "Braintrust",
  ],
  Testing: ["Playwright", "Cypress", "Jest", "Vitest", "pytest", "Selenium", "JUnit", "RSpec"],
  "Developer Tools": [
    "Git",
    "Vite",
    "Bazel",
    "CMake",
    "uv",
    "Ruff",
    "mypy",
    "Claude Code",
    "Cursor",
    "Codex",
    "GitHub Copilot",
    "Webpack",
    "Boost",
  ],
  Design: ["Figma"],
  Mobile: [
    "iOS",
    "Android",
    "React Native",
    "Flutter",
    "Expo",
    "SwiftUI",
    "UIKit",
    "Jetpack Compose",
  ],
  Desktop: ["Electron", "Tauri", "Qt", "AppKit"],
  "Geospatial/Graphics": [
    "Mapbox",
    "D3.js",
    "OpenGL",
    "Unreal Engine",
    "Unity",
    "Godot",
    "FFmpeg",
    "GStreamer",
    "WebGL",
    "WebGPU",
    "MapLibre",
    "deck.gl",
  ],
  "Networking/Security": [
    "OAuth",
    "OIDC",
    "SAML",
    "Auth0",
    "Keycloak",
    "Tailscale",
    "WireGuard",
    "Clerk",
  ],
  Robotics: ["ROS"],
  Embedded: ["Yocto", "Zephyr"],
  Runtime: ["WebAssembly", ".NET", "Bun", "Deno"],
  Validation: ["Zod"],
} as const

export const TECHNOLOGY_NAMES = Object.values(TECHNOLOGY_TAXONOMY).flat() as [
  (typeof TECHNOLOGY_TAXONOMY)[keyof typeof TECHNOLOGY_TAXONOMY][number],
  ...(typeof TECHNOLOGY_TAXONOMY)[keyof typeof TECHNOLOGY_TAXONOMY][number][],
]
export type Technology = (typeof TECHNOLOGY_NAMES)[number]
export const LANGUAGE_NAMES = TECHNOLOGY_TAXONOMY.Languages
export type Language = (typeof LANGUAGE_NAMES)[number]

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
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  k8s: "Kubernetes",
  node: "Node.js",
  nodejs: "Node.js",
  "react.js": "React",
  reactjs: "React",
  nextjs: "Next.js",
  "next js": "Next.js",
  wasm: "WebAssembly",
  nixos: "Nix",
  "spring boot": "Spring",
  js: "JavaScript",
  ts: "TypeScript",
  cpp: "C++",
  "c++11": "C++",
  "c++14": "C++",
  "c++17": "C++",
  "c++20": "C++",
  "c++23": "C++",
  "c sharp": "C#",
  csharp: "C#",
  python3: "Python",
  "objective c": "Objective-C",
  tailwind: "Tailwind CSS",
  tailwindcss: "Tailwind CSS",
  shadcn: "shadcn/ui",
  d3: "D3.js",
  "tanstack query": "TanStack",
  "tanstack router": "TanStack",
  "tanstack table": "TanStack",
  "react query": "TanStack",
  "nuxt.js": "Nuxt",
  "solid.js": "SolidJS",
  stimulusjs: "Stimulus",
  "phoenix liveview": "Phoenix",
  "temporal.io": "Temporal",
  "nest.js": "NestJS",
  "express.js": "Express",
  mssql: "SQL Server",
  "microsoft sql server": "SQL Server",
  cosmosdb: "Cosmos DB",
  timescale: "TimescaleDB",
  "digital ocean": "DigitalOcean",
  "google cloud platform": "GCP",
  "microsoft azure": "Azure",
  "azure cloud": "Azure",
  "microsoft .net": ".NET",
  "amazon web services": "AWS",
  lambda: "AWS Lambda",
  ecs: "AWS ECS",
  eks: "AWS EKS",
  fargate: "AWS Fargate",
  ec2: "AWS EC2",
  rds: "AWS RDS",
  "aws s3": "S3",
  "amazon s3": "S3",
  "amazon ec2": "AWS EC2",
  "amazon rds": "AWS RDS",
  "amazon sqs": "SQS",
  "google pub/sub": "Pub/Sub",
  cdk: "AWS CDK",
  argocd: "Argo CD",
  "argo-cd": "Argo CD",
  "gitlab ci/cd": "GitLab CI",
  "github copilot": "GitHub Copilot",
  otel: "OpenTelemetry",
  "sci-kit learn": "scikit-learn",
  sklearn: "scikit-learn",
  "scikit learn": "scikit-learn",
  scikitlearn: "scikit-learn",
  powerbi: "Power BI",
  threejs: "Three.js",
  "node js": "Node.js",
  pydanticai: "Pydantic AI",
  huggingface: "Hugging Face",
  "huggingface transformers": "Hugging Face Transformers",
  alpinejs: "Alpine.js",
  "alpine js": "Alpine.js",
  "apache iceberg": "Iceberg",
  "react.native": "React Native",
  "openai sdk": "OpenAI API",
  "anthropic sdk": "Anthropic API",
  "gemini sdk": "Gemini API",
  "model context protocol": "MCP",
  ros2: "ROS",
  "ros 2": "ROS",
  dotnet: ".NET",
  "asp.net": ".NET",
  "asp.net core": ".NET",
  ".net core": ".NET",
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

export function normalizeLanguage(value: unknown): Language | null {
  const technology = normalizeTechnology(value)
  return technology && (LANGUAGE_NAMES as readonly Technology[]).includes(technology)
    ? (technology as Language)
    : null
}

export function technologyMentions(
  text: string,
): Array<{ technology: Technology; mention: string; start: number; end: number }> {
  const names = new Set([...TECHNOLOGY_NAMES, ...Object.keys(TECHNOLOGY_ALIASES)])
  const matches = [...names].flatMap((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_+#&])`, "giu")
    return [...text.matchAll(pattern)].map((match) => ({
      technology: normalizeTechnology(name) as Technology,
      mention: match[0],
      start: match.index,
      end: match.index + match[0].length,
      canonical: TECHNOLOGY_NAMES.some(
        (technology) => technology.toLowerCase() === name.toLowerCase(),
      ),
    }))
  })
  const unique = new Map(
    matches.map((match) => [`${match.start}:${match.end}:${match.technology}`, match]),
  )
  return [...unique.values()]
    .filter(
      (match) =>
        !matches.some(
          (other) =>
            (other.canonical ||
              normalizeLanguage(other.technology) ||
              !normalizeLanguage(match.technology)) &&
            other.technology !== match.technology &&
            other.start <= match.start &&
            other.end >= match.end &&
            other.end - other.start > match.end - match.start,
        ),
    )
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .map(({ technology, mention, start, end }) => ({ technology, mention, start, end }))
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
const LanguageValueSchema = z.enum(LANGUAGE_NAMES)
const LanguageListSchema = z.preprocess((value) => {
  if (!Array.isArray(value)) return value
  return [
    ...new Set(
      value.flatMap((item) => {
        const normalized = normalizeLanguage(item)
        return normalized ? [normalized] : []
      }),
    ),
  ]
}, z.array(LanguageValueSchema))
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

const LanguageCountSchema = NamedCountSchema.extend({
  name: LanguageValueSchema,
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

const UnmappedTechnologySchema = z.object({
  mention: z.string().trim().min(1).max(100),
  quote: z.string().trim().min(1).max(300),
})

const TechnologyEvidenceSchema = UnmappedTechnologySchema.extend({
  technology: TechnologyValueSchema,
})

const ClassifiedJobBaseSchema = z.object({
  id: z.int(),
  languages: LanguageListSchema.default([]),
  technologies: TechnologyListSchema,
  role: RoleValueSchema,
  experience_level: z.enum(["Senior", "Mid", "Junior", "Not specified"]),
  remote: z.enum(["fully_remote", "hybrid", "onsite_only", "not_mentioned"]),
  equity_mentioned: z.boolean(),
  ai_ml_mentioned: z.boolean(),
  evidence: z.array(TechnologyEvidenceSchema).optional(),
  unmapped_technologies: z.array(UnmappedTechnologySchema).optional(),
})

const ClassifiedJobVariants = [
  ClassifiedJobBaseSchema.extend({
    salary_mentioned: z.literal(true),
    salary_band: StrictSalaryBandValueSchema,
  }),
  ClassifiedJobBaseSchema.extend({ salary_mentioned: z.literal(false), salary_band: z.null() }),
] as const

export const ClassifiedJobSchema = z.union(ClassifiedJobVariants).transform((job) => ({
  ...job,
  languages: [
    ...new Set([
      ...job.languages,
      ...job.technologies.flatMap((technology) => {
        const language = normalizeLanguage(technology)
        return language ? [language] : []
      }),
    ]),
  ],
  technologies: job.technologies.filter((technology) => !normalizeLanguage(technology)),
}))

const BatchClassifiedJobSchema = z.union([
  ClassifiedJobVariants[0]
    .omit({ languages: true, technologies: true, evidence: true, unmapped_technologies: true })
    .extend({
      is_job: z.boolean(),
      evidence_ids: z.array(z.int().min(0)),
      unmapped_mentions: z.array(z.string().trim().min(1).max(100)),
    }),
  ClassifiedJobVariants[1]
    .omit({ languages: true, technologies: true, evidence: true, unmapped_technologies: true })
    .extend({
      is_job: z.boolean(),
      evidence_ids: z.array(z.int().min(0)),
      unmapped_mentions: z.array(z.string().trim().min(1).max(100)),
    }),
])

export const BatchResponseSchema = z.object({
  jobs: z.array(BatchClassifiedJobSchema),
})

// The full analysis shape written to disk (with metadata and computed percentages)
export const AnalysisSchema = z.object({
  schema_version: z.literal("1.0"),
  date: dateStringSchema,
  run_id: z.string().trim(),
  job_count: z.int(),
  languages: z.array(LanguageCountSchema).default([]),
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
  classification: z
    .object({
      model: z.string().trim(),
      taxonomy_version: z.string().trim(),
      prompt_version: z.string().trim(),
    })
    .optional(),
})

// ==============================================================================
// classified.json — per-job LLM classifications
// ==============================================================================

export const ClassifiedDataSchema = z
  .object({
    schema_version: z.literal("1.0"),
    date: z.string().trim(),
    run_id: z.string().trim(),
    jobs: z.array(ClassifiedJobSchema),
    classified_at: z.string().trim().datetime(),
  })
  .refine((data) => new Set(data.jobs.map((job) => job.id)).size === data.jobs.length, {
    error: "Duplicate classified job IDs",
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
export type TechnologyEvidence = z.infer<typeof TechnologyEvidenceSchema>
export type ClassifiedData = z.infer<typeof ClassifiedDataSchema>
export type ManifestRun = z.infer<typeof ManifestRunSchema>
export type Manifest = z.infer<typeof ManifestSchema>
export type HistoryRun = z.infer<typeof HistoryRunSchema>
export type History = z.infer<typeof HistorySchema>
export type TrendSeries = z.infer<typeof TrendSeriesSchema>

export const API_TECHNOLOGIES = ["OpenAI API", "Anthropic API", "Gemini API"]
export const API_EVIDENCE_PATTERN =
  /\b(?:APIs?|SDKs?|endpoints?|integrat(?:e|es|ed|ing|ion|ions))\b/i

export function validateTechnologyEvidence(job: ClassifiedJob, text: string): void {
  const entries = job.evidence
  if (entries === undefined) return
  const technologies = new Set([...job.languages, ...job.technologies])
  const evidenceNames = new Set(entries.map((evidence) => evidence.technology))
  const missing = [...technologies].filter((technology) => !evidenceNames.has(technology))
  const extra = [...evidenceNames].filter((technology) => !technologies.has(technology))
  if (
    evidenceNames.size !== technologies.size ||
    [...technologies].some((technology) => !evidenceNames.has(technology))
  ) {
    throw new Error(
      `Job ${job.id}: each technology must have source evidence; missing=${missing.join(", ")}, extra=${extra.join(", ")}`,
    )
  }
  for (const evidence of entries) {
    if (!text.includes(evidence.quote)) {
      throw new Error(
        `Job ${job.id}: ${evidence.technology} quote not found in source: ${JSON.stringify(evidence.quote)}. Copy an exact excerpt or omit the tag.`,
      )
    }
    const supported = technologyMentions(evidence.quote).some(
      ({ technology, mention }) =>
        technology === evidence.technology && mention === evidence.mention,
    )
    if (!supported)
      throw new Error(
        `Job ${job.id}: unsupported evidence for ${evidence.technology}; mention=${JSON.stringify(evidence.mention)}, quote=${JSON.stringify(evidence.quote)}. Use the complete source name or alias.`,
      )
    if (
      API_TECHNOLOGIES.includes(evidence.technology) &&
      !API_EVIDENCE_PATTERN.test(evidence.quote)
    ) {
      throw new Error(
        `Job ${job.id}: ${evidence.technology} evidence must explicitly describe API or SDK usage`,
      )
    }
  }
  for (const evidence of job.unmapped_technologies ?? []) {
    if (
      !text.includes(evidence.quote) ||
      !evidence.quote.includes(evidence.mention) ||
      normalizeTechnology(evidence.mention)
    ) {
      throw new Error(`Job ${job.id}: invalid unmapped technology ${evidence.mention}`)
    }
  }
}
