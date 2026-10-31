import fs from "node:fs/promises"
import path from "node:path"
import { convert } from "html-to-text"
import {
  API_EVIDENCE_PATTERN,
  API_TECHNOLOGIES,
  technologyMentions,
  type TechnologyEvidence,
} from "./schemas.js"

export function prepareJobText(text: string): string {
  return convert(text, {
    wordwrap: false,
    selectors: [{ selector: "a", options: { ignoreHref: true } }],
  })
    .replace(/\s+/g, " ")
    .trim()
}

export function technologyEvidence(text: string): TechnologyEvidence[] {
  return technologyMentions(text)
    .map(({ technology, mention, start, end }) => ({
      technology,
      mention,
      quote: text.slice(Math.max(0, start - 100), end + 100).trim(),
    }))
    .filter(
      ({ technology, quote }) =>
        !API_TECHNOLOGIES.includes(technology) || API_EVIDENCE_PATTERN.test(quote),
    )
}

export function getRunMetadata(): { runId: string; date: string; runDir: string } {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const dayOfMonth = now.getUTCDate()

  // The 3rd-of-month run is "main", the 28th is "refresh", manual runs use "manual"
  let type: string
  if (process.env.GITHUB_EVENT_NAME === "workflow_dispatch") {
    type = "manual"
  } else if (dayOfMonth <= 14) {
    type = "main"
  } else {
    type = "refresh"
  }

  return {
    runId: `${date}-${type}`,
    date,
    runDir: path.resolve("runs", date),
  }
}

export async function writeJSON(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n")
}

export async function readJSON<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf-8")
  return JSON.parse(content) as T
}
