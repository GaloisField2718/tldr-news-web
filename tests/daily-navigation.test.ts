import { describe, expect, it, vi } from "vitest"
import {
  bindDailyKeyboard,
  focusDailyReadingTarget,
  handleDailyShortcut,
  requestImmersiveMode,
  resolveDailyShortcut,
  resolveDailySwipe,
  scrollDailyViewport,
  shareDailyPage,
  updateDailyImmersiveBody,
  type DailyShortcutContext,
} from "@/lib/daily-interactions"
import {
  createDailyEditionNavigation,
  dailyPageHref,
  exactDailyPageUrl,
} from "@/lib/daily-navigation"
import type { DailyPage } from "@/lib/daily-types"

function page(number: number): DailyPage {
  return {
    number,
    template: number === 1 ? "front-page" : "three-column",
    title: `Page ${number}`,
    kicker: null,
    sectors: ["TLDR"],
    slots: [{ role: "standard", article_key: `key-${number}` }],
  }
}

function shortcut(overrides: Partial<DailyShortcutContext> = {}): DailyShortcutContext {
  return {
    key: "ArrowRight",
    defaultPrevented: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    interactiveTarget: false,
    hasSelection: false,
    contentsOpen: false,
    immersive: false,
    fallbackImmersive: false,
    currentPage: 2,
    pageCount: 3,
    previousPageHref: "/daily/2026-07-20",
    nextPageHref: "/daily/2026-07-20?page=3",
    firstPageHref: "/daily/2026-07-20",
    lastPageHref: "/daily/2026-07-20?page=3",
    ...overrides,
  }
}

describe("canonical Daily navigation URLs", () => {
  it("uses the canonical page-one and numbered-page forms everywhere", () => {
    expect(dailyPageHref("2026-07-20", 1)).toBe("/daily/2026-07-20")
    expect(dailyPageHref("2026-07-20", 2)).toBe("/daily/2026-07-20?page=2")
    expect(exactDailyPageUrl("https://index.example", "2026-07-20", 1)).toBe("https://index.example/daily/2026-07-20")
    expect(exactDailyPageUrl("https://index.example", "2026-07-20", 2)).toBe("https://index.example/daily/2026-07-20?page=2")
  })

  it("builds compact previous, next, first, last, and contents hrefs", () => {
    const navigation = createDailyEditionNavigation({
      date: "2026-07-20",
      formattedDate: "Jul 20, 2026",
      currentPage: 2,
      pages: [page(1), page(2), page(3)],
      previousDate: "2026-07-19",
      nextDate: "2026-07-21",
      latestDate: "2026-07-21",
    })
    expect(navigation.previousPageHref).toBe("/daily/2026-07-20")
    expect(navigation.nextPageHref).toBe("/daily/2026-07-20?page=3")
    expect(navigation.firstPageHref).toBe("/daily/2026-07-20")
    expect(navigation.lastPageHref).toBe("/daily/2026-07-20?page=3")
    expect(navigation.pages.map((item) => item.href)).toEqual([
      "/daily/2026-07-20",
      "/daily/2026-07-20?page=2",
      "/daily/2026-07-20?page=3",
    ])
    expect(JSON.stringify(navigation)).not.toMatch(/articles|article_key|slots/)
  })
})

describe("Daily keyboard shortcuts", () => {
  it.each([
    ["ArrowLeft", "/daily/2026-07-20"],
    ["ArrowRight", "/daily/2026-07-20?page=3"],
    ["Home", "/daily/2026-07-20"],
    ["End", "/daily/2026-07-20?page=3"],
  ])("resolves %s to its canonical destination", (key, href) => {
    expect(resolveDailyShortcut(shortcut({ key }))).toEqual({ type: "navigate", href })
  })

  it("does nothing at page boundaries", () => {
    expect(resolveDailyShortcut(shortcut({ key: "ArrowLeft", currentPage: 1, previousPageHref: undefined }))).toBeNull()
    expect(resolveDailyShortcut(shortcut({ key: "Home", currentPage: 1 }))).toBeNull()
    expect(resolveDailyShortcut(shortcut({ key: "ArrowRight", currentPage: 3, nextPageHref: undefined }))).toBeNull()
    expect(resolveDailyShortcut(shortcut({ key: "End", currentPage: 3 }))).toBeNull()
  })

  it("toggles immersive mode with F and exits fallback with Escape", () => {
    expect(resolveDailyShortcut(shortcut({ key: "f" }))).toEqual({ type: "toggle-immersive" })
    expect(resolveDailyShortcut(shortcut({ key: "Escape", fallbackImmersive: true, interactiveTarget: true }))).toEqual({ type: "exit-fallback" })
  })

  it.each([
    ["ArrowDown", false, 1, "increment"],
    ["ArrowUp", false, -1, "increment"],
    ["PageDown", false, 1, "viewport"],
    ["PageUp", false, -1, "viewport"],
    [" ", false, 1, "viewport"],
    [" ", true, -1, "viewport"],
  ] as const)("resolves immersive %s reading movement", (key, shiftKey, direction, amount) => {
    expect(resolveDailyShortcut(shortcut({ key, shiftKey, immersive: true }))).toEqual({
      type: "scroll",
      direction,
      amount,
    })
  })

  it.each(["ArrowDown", "ArrowUp", "PageDown", "PageUp", " "])("leaves %s native outside immersive mode", (key) => {
    expect(resolveDailyShortcut(shortcut({ key }))).toBeNull()
  })

  it.each(["ctrlKey", "metaKey", "altKey", "shiftKey"] as const)("suppresses shortcuts with %s", (modifier) => {
    expect(resolveDailyShortcut(shortcut({ [modifier]: true }))).toBeNull()
  })

  it.each([
    "input",
    "textarea",
    "select",
    "button",
    "link",
    "contenteditable",
    "summary",
  ])("suppresses shortcuts for focused %s controls", () => {
    expect(resolveDailyShortcut(shortcut({ interactiveTarget: true }))).toBeNull()
  })

  it("suppresses page shortcuts for open Contents, selections, and prevented events", () => {
    expect(resolveDailyShortcut(shortcut({ contentsOpen: true }))).toBeNull()
    expect(resolveDailyShortcut(shortcut({ hasSelection: true }))).toBeNull()
    expect(resolveDailyShortcut(shortcut({ defaultPrevented: true }))).toBeNull()
  })

  it.each([
    { interactiveTarget: true },
    { contentsOpen: true },
    { hasSelection: true },
    { defaultPrevented: true },
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
  ])("suppresses immersive vertical movement for unsafe context %#", (override) => {
    expect(resolveDailyShortcut(shortcut({ key: "ArrowDown", immersive: true, ...override }))).toBeNull()
  })

  it("allows Shift only for Shift+Space", () => {
    expect(resolveDailyShortcut(shortcut({ key: "ArrowDown", shiftKey: true, immersive: true }))).toBeNull()
    expect(resolveDailyShortcut(shortcut({ key: "PageUp", shiftKey: true, immersive: true }))).toBeNull()
    expect(resolveDailyShortcut(shortcut({ key: " ", shiftKey: true, immersive: true }))).toEqual({
      type: "scroll",
      direction: -1,
      amount: "viewport",
    })
  })

  it("prevents default only for actions that are actually handled", () => {
    const preventDefault = vi.fn()
    const navigate = vi.fn(() => true)
    expect(handleDailyShortcut(shortcut(), {
      navigate,
      scroll: vi.fn(() => true),
      toggleImmersive: vi.fn(),
      exitFallback: vi.fn(),
      preventDefault,
    })).toBe(true)
    expect(preventDefault).toHaveBeenCalledOnce()
    preventDefault.mockClear()
    expect(handleDailyShortcut(shortcut({ interactiveTarget: true }), {
      navigate,
      scroll: vi.fn(() => true),
      toggleImmersive: vi.fn(),
      exitFallback: vi.fn(),
      preventDefault,
    })).toBe(false)
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it("scrolls the immersive viewport and prevents default only when movement occurs", () => {
    const preventDefault = vi.fn()
    const scrollTo = vi.fn()
    const viewport = { scrollTop: 200, scrollHeight: 2000, clientHeight: 800, scrollTo }
    const handlers = {
      navigate: vi.fn(() => true),
      scroll: (action: Parameters<typeof scrollDailyViewport>[1]) => scrollDailyViewport(viewport, action),
      toggleImmersive: vi.fn(),
      exitFallback: vi.fn(),
      preventDefault,
    }

    expect(handleDailyShortcut(shortcut({ key: "ArrowDown", immersive: true }), handlers)).toBe(true)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 360, behavior: "auto" })
    expect(preventDefault).toHaveBeenCalledOnce()

    viewport.scrollTop = 0
    preventDefault.mockClear()
    scrollTo.mockClear()
    expect(handleDailyShortcut(shortcut({ key: "ArrowUp", immersive: true }), handlers)).toBe(false)
    expect(scrollTo).not.toHaveBeenCalled()
    expect(preventDefault).not.toHaveBeenCalled()

    viewport.scrollTop = 1200
    expect(handleDailyShortcut(shortcut({ key: "PageDown", immersive: true }), handlers)).toBe(false)
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it("does not handle any vertical reading key at its scroll boundary", () => {
    const preventDefault = vi.fn()
    const scrollTo = vi.fn()
    const viewport = { scrollTop: 0, scrollHeight: 1800, clientHeight: 800, scrollTo }
    const handlers = {
      navigate: vi.fn(() => true),
      scroll: (action: Parameters<typeof scrollDailyViewport>[1]) => scrollDailyViewport(viewport, action),
      toggleImmersive: vi.fn(),
      exitFallback: vi.fn(),
      preventDefault,
    }
    for (const context of [
      shortcut({ key: "ArrowUp", immersive: true }),
      shortcut({ key: "PageUp", immersive: true }),
      shortcut({ key: " ", shiftKey: true, immersive: true }),
    ]) expect(handleDailyShortcut(context, handlers)).toBe(false)

    viewport.scrollTop = 1000
    for (const key of ["ArrowDown", "PageDown", " "]) {
      expect(handleDailyShortcut(shortcut({ key, immersive: true }), handlers)).toBe(false)
    }
    expect(scrollTo).not.toHaveBeenCalled()
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it("uses viewport-sized increments for Page and Space shortcuts in both directions", () => {
    const scrollTo = vi.fn()
    const viewport = { scrollTop: 800, scrollHeight: 3000, clientHeight: 1000, scrollTo }
    expect(scrollDailyViewport(viewport, { type: "scroll", direction: 1, amount: "viewport" })).toBe(true)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 1650, behavior: "auto" })
    viewport.scrollTop = 1650
    expect(scrollDailyViewport(viewport, { type: "scroll", direction: -1, amount: "viewport" })).toBe(true)
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 800, behavior: "auto" })
  })

  it("focuses the immersive viewport and restores the fullscreen control without scrolling", () => {
    const readingFocus = vi.fn()
    const buttonFocus = vi.fn()
    expect(focusDailyReadingTarget({ focus: readingFocus })).toBe(true)
    expect(readingFocus).toHaveBeenCalledWith({ preventScroll: true })
    expect(focusDailyReadingTarget({ focus: buttonFocus })).toBe(true)
    expect(buttonFocus).toHaveBeenCalledWith({ preventScroll: true })
    expect(focusDailyReadingTarget(null)).toBe(false)
  })

  it("registers one listener and returns cleanup", () => {
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    const listener = vi.fn()
    const cleanup = bindDailyKeyboard({ addEventListener, removeEventListener }, listener)
    expect(addEventListener).toHaveBeenCalledWith("keydown", listener)
    cleanup()
    expect(removeEventListener).toHaveBeenCalledWith("keydown", listener)
  })
})

describe("conservative Daily swipe resolution", () => {
  const base = {
    deltaX: -80,
    deltaY: 20,
    touchCount: 1,
    cancelled: false,
    interactiveStart: false,
    hasSelection: false,
    previousPageHref: "/previous",
    nextPageHref: "/next",
  }
  it("maps qualifying left and right swipes", () => {
    expect(resolveDailySwipe(base)).toBe("/next")
    expect(resolveDailySwipe({ ...base, deltaX: 80 })).toBe("/previous")
  })
  it.each([
    { deltaX: 20, deltaY: 90 },
    { deltaX: 50, deltaY: 5 },
    { deltaX: 80, deltaY: 60 },
    { touchCount: 2 },
    { cancelled: true },
    { interactiveStart: true },
    { hasSelection: true },
  ])("ignores unsafe gesture %#", (override) => {
    expect(resolveDailySwipe({ ...base, ...override })).toBeNull()
  })
  it("does nothing at page boundaries", () => {
    expect(resolveDailySwipe({ ...base, nextPageHref: undefined })).toBeNull()
    expect(resolveDailySwipe({ ...base, deltaX: 80, previousPageHref: undefined })).toBeNull()
  })
})

describe("immersive and sharing adapters", () => {
  it("activates and completely cleans up fallback body state", () => {
    const body = { dataset: {} as Record<string, string | undefined>, style: { overflow: "auto" } }
    let previous = updateDailyImmersiveBody(body, "fallback", null)
    expect(body).toEqual({ dataset: { dailyImmersive: "fallback" }, style: { overflow: "hidden" } })
    previous = updateDailyImmersiveBody(body, "native", previous)
    expect(body.dataset.dailyImmersive).toBe("native")
    previous = updateDailyImmersiveBody(body, null, previous)
    expect(previous).toBeNull()
    expect(body).toEqual({ dataset: {}, style: { overflow: "auto" } })
  })

  it("requests native fullscreen only through an explicit call and falls back safely", async () => {
    const request = vi.fn(async () => undefined)
    expect(await requestImmersiveMode(request)).toBe("native")
    expect(request).toHaveBeenCalledOnce()
    expect(await requestImmersiveMode()).toBe("fallback")
    expect(await requestImmersiveMode(async () => { throw new Error("denied") })).toBe("fallback")
  })

  it("prefers native share and treats cancellation separately", async () => {
    const share = vi.fn(async () => undefined)
    const writeText = vi.fn(async () => undefined)
    expect(await shareDailyPage({ title: "Daily", url: "https://example.test/page", share, writeText })).toBe("Shared")
    expect(writeText).not.toHaveBeenCalled()
    const cancellation = new Error("cancelled")
    cancellation.name = "AbortError"
    expect(await shareDailyPage({ title: "Daily", url: "https://example.test/page", share: async () => { throw cancellation }, writeText })).toBe("Share cancelled")
  })

  it("copies the exact URL or fails safely when sharing is unavailable", async () => {
    const writeText = vi.fn(async () => undefined)
    expect(await shareDailyPage({ title: "Daily", url: "https://example.test/daily/date?page=2", writeText })).toBe("Link copied")
    expect(writeText).toHaveBeenCalledWith("https://example.test/daily/date?page=2")
    expect(await shareDailyPage({ title: "Daily", url: "https://example.test" })).toBe("Unable to share")
  })
})
