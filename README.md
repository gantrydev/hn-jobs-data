# hn-jobs-data

Data pipeline that fetches job postings from Hacker News, analyzes them with an LLM, and publishes structured JSON via GitHub Pages.

Runs automatically on the 3rd and 28th of each month via GitHub Actions.

## How it works

```
HN APIs → fetch.ts → raw.json → analyze.ts → analysis.json → index.ts → index files
                                      ↓
                              OpenRouter (MODEL)
```

1. **Fetch** — pulls jobs from two HN sources:
   - The monthly "Who is Hiring?" thread (via Algolia search)
   - Direct job posts (`/v0/jobstories`)
2. **Analyze** — sends job texts to the configured OpenRouter model (`MODEL`, default `openai/gpt-6-luna`) in batched parallel calls (10 jobs per batch). Extracts technologies, roles, compensation, remote policy, and experience levels. Validates the schema, exact job-ID coverage, and quoted source evidence before publishing.
3. **Index** — updates `latest.json`, `manifest.json`, `history.json`, `tech-trends.json`, and `role-trends.json` for consumption by [hn-jobs-site](https://github.com/gantryops/hn-jobs-site).

## Output

JSON files are served via GitHub Pages at:

```
https://data.hn-job-trends.gantryops.dev/indexes/latest.json
https://data.hn-job-trends.gantryops.dev/indexes/manifest.json
https://data.hn-job-trends.gantryops.dev/indexes/history.json
https://data.hn-job-trends.gantryops.dev/indexes/tech-trends.json
https://data.hn-job-trends.gantryops.dev/indexes/role-trends.json
```

## Run manually

```bash
pnpm install
OPENROUTER_API_KEY=your_key pnpm pipeline
```

To normalize stored language classifications and recompute aggregates without LLM calls,
run `pnpm reprocess --normalize`, then `pnpm index`. Index rebuilding also regenerates
analytics. Duplicate or unknown classification IDs must be corrected before normalization.

To reclassify history with the current taxonomy and prompt, run
`MODEL=openai/gpt-6-luna pnpm reprocess`, then `pnpm index`. This makes new LLM
requests using the saved raw posts.

Each new classification includes `evidence[]` with the canonical technology,
the exact name or alias mentioned, and a verbatim quote from the decoded posting
text. The pipeline extracts named candidates and their quotes; the model selects
candidate IDs. HTML is decoded and whitespace is normalized before extraction.
Only the employer's stack and skills sought for the role count; customer names, employment history,
and competitor comparisons do not. API tags also require explicit API or SDK context.
Names outside the taxonomy are retained in `unmapped_technologies[]` with quotes
and excluded from aggregate counts.
Literal evidence is validated automatically; employer relevance and other fields
remain model decisions and can need manual review.

`analysis.json` records the model, taxonomy version, and prompt version in
`classification`. Older files may lack evidence and version metadata; normalization
preserves their labels, while reprocessing generates fresh evidence.

TODO: Review recurring unmapped technology names and their source context before
adding canonical names or aliases to the taxonomy.

## Stack

- **Node.js 22** + **TypeScript** + **tsx**
- **Zod** for schema validation
- **pnpm** for package management
- **GitHub Actions** for scheduling
- **GitHub Pages** for serving JSON

## Data Sources

- Job data from [Hacker News](https://news.ycombinator.com) via the [HN Firebase API](https://github.com/HackerNews/API) (MIT) and [HN Algolia API](https://hn.algolia.com/api)
- LLM classification via [OpenRouter](https://openrouter.ai)

## License

MIT

---

Built by [GantryOps](https://gantryops.dev). Need help with your infrastructure? [Start with an audit.](https://gantryops.dev/#pricing)
