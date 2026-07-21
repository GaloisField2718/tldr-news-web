"use client"

import type { ReactNode, TouchEvent as ReactTouchEvent } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { DailyToolbar } from "@/components/daily-toolbar"
import {
  bindDailyKeyboard,
  handleDailyShortcut,
  requestImmersiveMode,
  resolveDailySwipe,
  shareDailyPage,
  updateDailyImmersiveBody,
} from "@/lib/daily-interactions"
import { exactDailyPageUrl, type DailyEditionNavigation } from "@/lib/daily-navigation"

const INTERACTIVE_SELECTOR = "a,button,input,textarea,select,summary,details,[contenteditable='true'],[role]"
const SHORTCUT_HINT_KEY = "tldr-daily-shortcuts-v1"

function hasTextSelection(): boolean {
  return Boolean(window.getSelection()?.toString().trim())
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR))
}

export function DailyEditionShell({
  navigation,
  children,
}: {
  navigation: DailyEditionNavigation
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const navigationRef = useRef(navigation)
  const contentsRef = useRef<HTMLDetailsElement>(null)
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const navigatingRef = useRef(false)
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bodyOverflowRef = useRef<string | null>(null)
  const fallbackRef = useRef(false)
  const wasImmersiveRef = useRef(false)
  const previousPageRef = useRef(navigation.currentPage)
  const touchRef = useRef<{
    x: number
    y: number
    touchCount: number
    interactive: boolean
    cancelled: boolean
  } | null>(null)
  const [enhanced, setEnhanced] = useState(false)
  const [fallbackImmersive, setFallbackImmersive] = useState(false)
  const [nativeFullscreen, setNativeFullscreen] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [announcement, setAnnouncement] = useState("")
  const [showHint, setShowHint] = useState(false)
  const immersive = fallbackImmersive || nativeFullscreen

  useEffect(() => {
    navigationRef.current = navigation
  }, [navigation])

  useEffect(() => {
    const timer = setTimeout(() => setEnhanced(true), 0)
    return () => clearTimeout(timer)
  }, [])

  const setDocumentImmersive = useCallback((kind: "native" | "fallback" | null) => {
    bodyOverflowRef.current = updateDailyImmersiveBody(
      document.body,
      kind,
      bodyOverflowRef.current,
    )
  }, [])

  const exitFallback = useCallback(() => {
    setFallbackImmersive(false)
    fallbackRef.current = false
    if (!document.fullscreenElement) setDocumentImmersive(null)
  }, [setDocumentImmersive])

  const toggleImmersive = useCallback(async () => {
    if (fallbackRef.current) {
      exitFallback()
      return
    }
    if (document.fullscreenElement) {
      try { await document.exitFullscreen() } catch { /* fullscreenchange remains authoritative */ }
      return
    }
    const request = document.documentElement.requestFullscreen?.bind(document.documentElement)
    const result = await requestImmersiveMode(request)
    if (result === "native") {
      setNativeFullscreen(true)
      setDocumentImmersive("native")
    } else {
      fallbackRef.current = true
      setFallbackImmersive(true)
      setDocumentImmersive("fallback")
    }
  }, [exitFallback, setDocumentImmersive])

  const navigate = useCallback((href?: string) => {
    if (!href || navigatingRef.current) return false
    navigatingRef.current = true
    router.push(href)
    if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current)
    navigationTimerRef.current = setTimeout(() => { navigatingRef.current = false }, 1200)
    return true
  }, [router])

  useEffect(() => {
    navigatingRef.current = false
    if (previousPageRef.current === navigation.currentPage) return
    previousPageRef.current = navigation.currentPage
    const frame = requestAnimationFrame(() => {
      setAnnouncement(`Page ${navigation.currentPage} of ${navigation.pageCount}`)
      if (immersive) shellRef.current?.scrollTo({ top: 0, behavior: "instant" })
      else surfaceRef.current?.scrollIntoView({ block: "start" })
    })
    return () => cancelAnimationFrame(frame)
  }, [navigation.currentPage, navigation.pageCount, immersive])

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement)
      setNativeFullscreen(active)
      if (active) {
        setFallbackImmersive(false)
        fallbackRef.current = false
        setDocumentImmersive("native")
      } else if (!fallbackRef.current) {
        setDocumentImmersive(null)
      }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [setDocumentImmersive])

  useEffect(() => {
    if (wasImmersiveRef.current && !immersive && pathname === `/daily/${navigation.date}`) {
      fullscreenButtonRef.current?.focus()
    }
    wasImmersiveRef.current = immersive
  }, [immersive, navigation.date, pathname])

  useEffect(() => {
    if (pathname === `/daily/${navigation.date}`) return
    fallbackRef.current = false
    let active = true
    queueMicrotask(() => {
      if (active) {
        setFallbackImmersive(false)
        setNativeFullscreen(false)
      }
    })
    if (document.fullscreenElement && document.body.dataset.dailyImmersive) {
      void document.exitFullscreen().catch(() => undefined)
    }
    setDocumentImmersive(null)
    return () => { active = false }
  }, [navigation.date, pathname, setDocumentImmersive])

  useEffect(() => {
    try {
      if (
        window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
        !window.localStorage.getItem(SHORTCUT_HINT_KEY)
      ) {
        window.localStorage.setItem(SHORTCUT_HINT_KEY, "shown")
        const showTimer = setTimeout(() => setShowHint(true), 0)
        const hideTimer = setTimeout(() => setShowHint(false), 5500)
        return () => {
          clearTimeout(showTimer)
          clearTimeout(hideTimer)
        }
      }
    } catch {
      // Storage and media-query failures must not affect reading.
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = navigationRef.current
      const handled = handleDailyShortcut(
        {
          key: event.key,
          defaultPrevented: event.defaultPrevented,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
          interactiveTarget: isInteractiveTarget(event.target),
          hasSelection: hasTextSelection(),
          contentsOpen: Boolean(contentsRef.current?.open),
          fallbackImmersive: fallbackRef.current,
          currentPage: current.currentPage,
          pageCount: current.pageCount,
          previousPageHref: current.previousPageHref,
          nextPageHref: current.nextPageHref,
          firstPageHref: current.firstPageHref,
          lastPageHref: current.lastPageHref,
        },
        {
          navigate,
          toggleImmersive: () => { void toggleImmersive() },
          exitFallback,
          preventDefault: () => event.preventDefault(),
        },
      )
      if (handled) setShowHint(false)
    }
    return bindDailyKeyboard(window, onKeyDown)
  }, [exitFallback, navigate, toggleImmersive])

  useEffect(() => () => {
    if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current)
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    if (document.fullscreenElement && document.body.dataset.dailyImmersive) {
      void document.exitFullscreen().catch(() => undefined)
    }
    setDocumentImmersive(null)
  }, [setDocumentImmersive])

  const onShare = useCallback(async () => {
    const current = navigationRef.current
    const url = exactDailyPageUrl(window.location.origin, current.date, current.currentPage)
    const status = await shareDailyPage({
      title: `The Daily Index — ${current.formattedDate} — Page ${current.currentPage}`,
      url,
      share: navigator.share?.bind(navigator),
      writeText: navigator.clipboard?.writeText?.bind(navigator.clipboard),
    })
    setFeedback(status)
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = setTimeout(() => setFeedback(""), 2600)
  }, [])

  const onTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    touchRef.current = touch ? {
      x: touch.clientX,
      y: touch.clientY,
      touchCount: event.touches.length,
      interactive: isInteractiveTarget(event.target),
      cancelled: event.touches.length !== 1,
    } : null
  }

  const onTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (touchRef.current && event.touches.length !== 1) touchRef.current.cancelled = true
  }

  const onTouchCancel = () => {
    if (touchRef.current) touchRef.current.cancelled = true
  }

  const onTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchRef.current
    touchRef.current = null
    const touch = event.changedTouches[0]
    if (!start || !touch) return
    const current = navigationRef.current
    const href = resolveDailySwipe({
      deltaX: touch.clientX - start.x,
      deltaY: touch.clientY - start.y,
      touchCount: start.touchCount,
      cancelled: start.cancelled,
      interactiveStart: start.interactive,
      hasSelection: hasTextSelection(),
      previousPageHref: current.previousPageHref,
      nextPageHref: current.nextPageHref,
    })
    if (href) navigate(href)
  }

  return (
    <div
      ref={shellRef}
      className="daily-immersive-shell"
      data-daily-edition-shell
      data-daily-enhanced={enhanced ? "true" : undefined}
    >
      <DailyToolbar
        navigation={navigation}
        immersive={immersive}
        contentsRef={contentsRef}
        fullscreenButtonRef={fullscreenButtonRef}
        onShare={() => void onShare()}
        onToggleImmersive={() => void toggleImmersive()}
      />
      {showHint && <p className="daily-shortcut-hint">Use ← → to turn pages · F for full screen</p>}
      <div
        ref={surfaceRef}
        className="daily-paper-frame"
        data-newspaper-surface
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchCancel={onTouchCancel}
        onTouchEnd={onTouchEnd}
      >
        {navigation.previousPageHref && (
          <Link className="daily-side-arrow daily-side-arrow-previous" href={navigation.previousPageHref} aria-label="Previous newspaper page">
            <span aria-hidden="true">←</span>
          </Link>
        )}
        {children}
        {navigation.nextPageHref && (
          <Link className="daily-side-arrow daily-side-arrow-next" href={navigation.nextPageHref} aria-label="Next newspaper page">
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
      <div className="daily-share-feedback" aria-live="polite" aria-atomic="true">{feedback}</div>
    </div>
  )
}
