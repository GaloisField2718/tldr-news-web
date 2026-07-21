export type DailyScrollAction = {
  type: "scroll"
  direction: -1 | 1
  amount: "increment" | "viewport"
}

export type DailyShortcutAction =
  | { type: "navigate"; href: string }
  | DailyScrollAction
  | { type: "toggle-immersive" }
  | { type: "exit-fallback" }

export interface DailyShortcutContext {
  key: string
  defaultPrevented: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  interactiveTarget: boolean
  hasSelection: boolean
  contentsOpen: boolean
  immersive: boolean
  fallbackImmersive: boolean
  currentPage: number
  pageCount: number
  previousPageHref?: string
  nextPageHref?: string
  firstPageHref: string
  lastPageHref: string
}

export function resolveDailyShortcut(context: DailyShortcutContext): DailyShortcutAction | null {
  if (
    context.defaultPrevented ||
    context.ctrlKey ||
    context.metaKey ||
    context.altKey ||
    (context.shiftKey && context.key !== " ")
  ) return null

  if (context.key === "Escape" && context.fallbackImmersive) {
    return { type: "exit-fallback" }
  }
  if (context.interactiveTarget || context.hasSelection) return null

  if (context.key === "f" || context.key === "F") return { type: "toggle-immersive" }
  if (context.contentsOpen) return null

  if (context.immersive) {
    if (context.key === "ArrowDown") return { type: "scroll", direction: 1, amount: "increment" }
    if (context.key === "ArrowUp") return { type: "scroll", direction: -1, amount: "increment" }
    if (context.key === "PageDown" || (context.key === " " && !context.shiftKey)) {
      return { type: "scroll", direction: 1, amount: "viewport" }
    }
    if (context.key === "PageUp" || (context.key === " " && context.shiftKey)) {
      return { type: "scroll", direction: -1, amount: "viewport" }
    }
  }

  if (context.key === "ArrowLeft" && context.previousPageHref) {
    return { type: "navigate", href: context.previousPageHref }
  }
  if (context.key === "ArrowRight" && context.nextPageHref) {
    return { type: "navigate", href: context.nextPageHref }
  }
  if (context.key === "Home" && context.currentPage > 1) {
    return { type: "navigate", href: context.firstPageHref }
  }
  if (context.key === "End" && context.currentPage < context.pageCount) {
    return { type: "navigate", href: context.lastPageHref }
  }
  return null
}

export function handleDailyShortcut(
  context: DailyShortcutContext,
  handlers: {
    navigate: (href: string) => boolean
    scroll: (action: DailyScrollAction) => boolean
    toggleImmersive: () => void
    exitFallback: () => void
    preventDefault: () => void
  },
): boolean {
  const action = resolveDailyShortcut(context)
  if (!action) return false
  if (action.type === "navigate" && !handlers.navigate(action.href)) return false
  if (action.type === "scroll" && !handlers.scroll(action)) return false
  handlers.preventDefault()
  if (action.type === "toggle-immersive") handlers.toggleImmersive()
  if (action.type === "exit-fallback") handlers.exitFallback()
  return true
}

export interface DailyScrollViewport {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  scrollTo(options: { top: number; behavior: "auto" }): void
}

export function scrollDailyViewport(
  viewport: DailyScrollViewport,
  action: DailyScrollAction,
): boolean {
  const maximum = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
  const distance = action.amount === "viewport"
    ? viewport.clientHeight * 0.85
    : Math.max(80, Math.min(180, viewport.clientHeight * 0.2))
  const target = Math.max(0, Math.min(maximum, viewport.scrollTop + action.direction * distance))
  if (Math.abs(target - viewport.scrollTop) < 1) return false
  viewport.scrollTo({ top: target, behavior: "auto" })
  return true
}

export function focusDailyReadingTarget(
  target?: { focus(options?: FocusOptions): void } | null,
): boolean {
  if (!target) return false
  target.focus({ preventScroll: true })
  return true
}

export interface DailySwipeInput {
  deltaX: number
  deltaY: number
  touchCount: number
  cancelled: boolean
  interactiveStart: boolean
  hasSelection: boolean
  previousPageHref?: string
  nextPageHref?: string
}

export function resolveDailySwipe(input: DailySwipeInput): string | null {
  if (
    input.cancelled ||
    input.touchCount !== 1 ||
    input.interactiveStart ||
    input.hasSelection ||
    Math.abs(input.deltaX) < 65 ||
    Math.abs(input.deltaX) < Math.abs(input.deltaY) * 1.5
  ) return null
  return input.deltaX < 0 ? (input.nextPageHref ?? null) : (input.previousPageHref ?? null)
}

export interface KeyboardEventSource {
  addEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void
  removeEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void
}

export function bindDailyKeyboard(
  source: KeyboardEventSource,
  listener: (event: KeyboardEvent) => void,
): () => void {
  source.addEventListener("keydown", listener)
  return () => source.removeEventListener("keydown", listener)
}

export interface DailyImmersiveBody {
  dataset: Record<string, string | undefined>
  style: { overflow: string }
}

export function updateDailyImmersiveBody(
  body: DailyImmersiveBody,
  kind: "native" | "fallback" | null,
  previousOverflow: string | null,
): string | null {
  if (kind) {
    const restore = previousOverflow ?? body.style.overflow
    body.dataset.dailyImmersive = kind
    body.style.overflow = "hidden"
    return restore
  }
  delete body.dataset.dailyImmersive
  if (previousOverflow !== null) body.style.overflow = previousOverflow
  return null
}

export async function requestImmersiveMode(
  requestFullscreen?: () => Promise<void>,
): Promise<"native" | "fallback"> {
  if (!requestFullscreen) return "fallback"
  try {
    await requestFullscreen()
    return "native"
  } catch {
    return "fallback"
  }
}

export type ShareFeedback = "Shared" | "Link copied" | "Share cancelled" | "Unable to share"

export async function shareDailyPage({
  title,
  url,
  share,
  writeText,
}: {
  title: string
  url: string
  share?: (data: { title: string; url: string }) => Promise<void>
  writeText?: (text: string) => Promise<void>
}): Promise<ShareFeedback> {
  if (share) {
    try {
      await share({ title, url })
      return "Shared"
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "Share cancelled"
    }
  }
  if (writeText) {
    try {
      await writeText(url)
      return "Link copied"
    } catch {
      return "Unable to share"
    }
  }
  return "Unable to share"
}
