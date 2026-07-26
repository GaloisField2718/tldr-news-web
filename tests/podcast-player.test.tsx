import { readFileSync } from "node:fs"
import { describe,expect,it } from "vitest"
import { formatPodcastDuration,podcastShellState,preferredPodcastLanguage,storedPodcastMinimized,storedPodcastVolume } from "@/lib/podcast-session"
const shell=(overrides:Partial<Parameters<typeof podcastShellState>[0]>={})=>podcastShellState({hasEpisode:true,closed:false,primary:true,started:false,minimized:null,...overrides})
describe("podcast session preferences",()=>{
 it("chooses stored preference before browser language",()=>expect(preferredPodcastLanguage("en","fr-FR")).toBe("en"))
 it("uses French browser language and English fallback",()=>{expect(preferredPodcastLanguage(null,"fr-CA")).toBe("fr");expect(preferredPodcastLanguage(null,"de-DE")).toBe("en")})
 it("accepts only a stored volume inside the 0-1 range",()=>{expect(storedPodcastVolume("0.4")).toBe(0.4);expect(storedPodcastVolume("0")).toBe(0);expect(storedPodcastVolume("1")).toBe(1)})
 it("rejects a missing, malformed, or out-of-range stored volume",()=>{expect(storedPodcastVolume(null)).toBeNull();expect(storedPodcastVolume("loud")).toBeNull();expect(storedPodcastVolume("-0.1")).toBeNull();expect(storedPodcastVolume("1.4")).toBeNull()})
 it("distinguishes an explicit minimized choice from no choice at all",()=>{expect(storedPodcastMinimized("true")).toBe(true);expect(storedPodcastMinimized("false")).toBe(false);expect(storedPodcastMinimized(null)).toBeNull()})
 it("traces synchronized podcast artifacts into production output",()=>expect(readFileSync("next.config.mjs","utf8")).toContain("./.generated/podcast/**/*.json"))
})
describe("podcast episode duration label",()=>{
 it("rounds the episode length to whole minutes",()=>{expect(formatPodcastDuration(122.376)).toBe("2 min");expect(formatPodcastDuration(107.184)).toBe("2 min");expect(formatPodcastDuration(300)).toBe("5 min")})
 it("never rounds a real episode down to zero minutes",()=>expect(formatPodcastDuration(25)).toBe("1 min"))
 it("returns nothing for a missing or nonsensical duration",()=>{expect(formatPodcastDuration(0)).toBe("");expect(formatPodcastDuration(Number.NaN)).toBe("")})
})
describe("podcast dock visibility",()=>{
 // An edition should open on its own headline, not on an unrequested podcast bar.
 it("stays compact by default on the journal that owns the episode",()=>expect(shell()).toBe("compact"))
 it("stays compact by default once the reader leaves the owning route",()=>expect(shell({primary:false,started:true})).toBe("compact"))
 it("hides when no episode has been registered in this tab",()=>expect(shell({hasEpisode:false})).toBe("hidden"))
 it("hides after the user closed it",()=>expect(shell({closed:true})).toBe("hidden"))
 // DEC-006: a reader page opened in its own tab never registers an episode and never
 // started playback there, so that tab must not present an active player.
 it("hides off the owning route until playback has started in this tab",()=>expect(shell({primary:false,started:false})).toBe("hidden"))
 // B3: an explicit choice wins over the compact default, on and off the owning route.
 it("honours an explicit expand",()=>{expect(shell({minimized:false})).toBe("expanded");expect(shell({primary:false,started:true,minimized:false})).toBe("expanded")})
 it("honours an explicit minimize",()=>expect(shell({minimized:true})).toBe("compact"))
})
