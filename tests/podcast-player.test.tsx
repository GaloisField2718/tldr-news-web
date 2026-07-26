import { readFileSync } from "node:fs"
import { describe,expect,it } from "vitest"
import { podcastShellState,preferredPodcastLanguage,storedPodcastMinimized,storedPodcastVolume } from "@/lib/podcast-session"
const shell=(overrides:Partial<Parameters<typeof podcastShellState>[0]>={})=>podcastShellState({hasEpisode:true,closed:false,primary:true,started:false,minimized:null,...overrides})
describe("podcast session preferences",()=>{
 it("chooses stored preference before browser language",()=>expect(preferredPodcastLanguage("en","fr-FR")).toBe("en"))
 it("uses French browser language and English fallback",()=>{expect(preferredPodcastLanguage(null,"fr-CA")).toBe("fr");expect(preferredPodcastLanguage(null,"de-DE")).toBe("en")})
 it("accepts only a stored volume inside the 0-1 range",()=>{expect(storedPodcastVolume("0.4")).toBe(0.4);expect(storedPodcastVolume("0")).toBe(0);expect(storedPodcastVolume("1")).toBe(1)})
 it("rejects a missing, malformed, or out-of-range stored volume",()=>{expect(storedPodcastVolume(null)).toBeNull();expect(storedPodcastVolume("loud")).toBeNull();expect(storedPodcastVolume("-0.1")).toBeNull();expect(storedPodcastVolume("1.4")).toBeNull()})
 it("distinguishes an explicit minimized choice from no choice at all",()=>{expect(storedPodcastMinimized("true")).toBe(true);expect(storedPodcastMinimized("false")).toBe(false);expect(storedPodcastMinimized(null)).toBeNull()})
 it("traces synchronized podcast artifacts into production output",()=>expect(readFileSync("next.config.mjs","utf8")).toContain("./.generated/podcast/**/*.json"))
})
describe("podcast dock visibility",()=>{
 it("expands on the journal route that owns the episode",()=>expect(shell()).toBe("expanded"))
 it("compacts when the user minimized it",()=>expect(shell({minimized:true})).toBe("compact"))
 it("hides when no episode has been registered in this tab",()=>expect(shell({hasEpisode:false})).toBe("hidden"))
 it("hides after the user closed it",()=>expect(shell({closed:true})).toBe("hidden"))
 // DEC-006: a reader page opened in its own tab never registers an episode and never
 // started playback there, so that tab must not present an active player.
 it("hides off the owning route until playback has started in this tab",()=>expect(shell({primary:false,started:false})).toBe("hidden"))
 // B4: off the owning journal the dock defaults to compact, so it follows the reader
 // without taking over the page. B3: an explicit choice still wins over that default.
 it("compacts a started session once the reader leaves the owning route",()=>expect(shell({primary:false,started:true})).toBe("compact"))
 it("honours an explicit expand off the owning route",()=>expect(shell({primary:false,started:true,minimized:false})).toBe("expanded"))
 it("honours an explicit minimize on the owning route",()=>expect(shell({minimized:true})).toBe("compact"))
})
