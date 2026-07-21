import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = path.resolve(import.meta.dirname, "..")

async function filesBelow(relative: string): Promise<string[]> {
  const root = path.join(ROOT, relative)
  const files: string[] = []
  async function walk(directory: string) {
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return
      throw error
    }
    for (const entry of entries) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(file)
      else files.push(file)
    }
  }
  await walk(root)
  return files
}

describe("Daily production safety", () => {
  it("keeps Daily generated artifacts ignored and outside public", async () => {
    const ignore = await readFile(path.join(ROOT, ".gitignore"), "utf8")
    expect(ignore).toContain("/.generated/")
    const publicFiles = await filesBelow("public")
    expect(publicFiles.some((file) => file.includes("daily-metadata") || file.endsWith(".json.gz"))).toBe(false)
  })

  it("does not import fixtures from production Daily code", async () => {
    const files = [
      ...(await filesBelow("app/daily")),
      path.join(ROOT, "lib/daily.ts"),
      path.join(ROOT, "components/daily-toolbar.tsx"),
      path.join(ROOT, "components/newspaper-page.tsx"),
    ]
    for (const file of files) expect(await readFile(file, "utf8")).not.toMatch(/fixtures|tests\/helpers/)
  })

  it("uses explicit grid spans instead of mixed-layout child-number rules", async () => {
    const css = await readFile(path.join(ROOT, "app/globals.css"), "utf8")
    expect(css).not.toContain(".daily-story:nth-child")
    for (const span of [3, 4, 6, 8, 12]) expect(css).toContain(`.daily-story-span-${span}`)
  })

  it("has no client Daily module importing filesystem or raw corpus data", async () => {
    const files = [...(await filesBelow("app/daily")), path.join(ROOT, "components/daily-toolbar.tsx"), path.join(ROOT, "components/newspaper-page.tsx")]
    for (const file of files) {
      const source = await readFile(file, "utf8")
      if (/^["']use client["']/m.test(source)) {
        expect(source).not.toMatch(/node:fs|\.generated|\.cache|issues\//)
      }
    }
  })
})
