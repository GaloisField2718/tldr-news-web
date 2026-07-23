import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { describe,expect,it } from "vitest"
import { PodcastPlayer,preferredPodcastLanguage } from "@/components/podcast-player"
import type { DailyPodcast } from "@/lib/podcast"
const hash=`sha256:${"a".repeat(64)}`
const podcast:DailyPodcast={schema_version:"1.1.0",publication_date:"2026-07-21",status:"published",source_artifact_sha256:hash,speaker_profile:"daily-index-duo-v1",generated_at:"2026-07-22T00:00:00Z",published_at:"2026-07-22T00:00:00Z",languages:{en:{locale:"en-US",title:"English episode",summary:"English summary",duration_seconds:300,audio_url:`https://tldr-assets.noisy-dew-7159.workers.dev/podcast/daily/2026/07/21/en/${"a".repeat(64)}.mp3`,audio_sha256:hash,audio_bytes:1,mime_type:"audio/mpeg",script_sha256:hash},fr:{locale:"fr-FR",title:"Épisode français",summary:"Résumé français",duration_seconds:301,audio_url:`https://tldr-assets.noisy-dew-7159.workers.dev/podcast/daily/2026/07/21/fr/${"a".repeat(64)}.mp3`,audio_sha256:hash,audio_bytes:1,mime_type:"audio/mpeg",script_sha256:hash}}}
describe("bilingual podcast player",()=>{
 it("renders native English audio without autoplay and preserves both selectors",()=>{const html=renderToStaticMarkup(<PodcastPlayer podcast={podcast}/>);expect(html).toContain("English episode");expect(html).toContain("<audio");expect(html).toContain("controls");expect(html).not.toContain("autoplay");expect(html).toContain("Français")})
 it("chooses stored preference before browser language",()=>expect(preferredPodcastLanguage("en","fr-FR")).toBe("en"))
 it("uses French browser language and English fallback",()=>{expect(preferredPodcastLanguage(null,"fr-CA")).toBe("fr");expect(preferredPodcastLanguage(null,"de-DE")).toBe("en")})
 it("traces synchronized podcast artifacts into production output",()=>expect(readFileSync("next.config.mjs","utf8")).toContain("./.generated/podcast/**/*.json"))
})
