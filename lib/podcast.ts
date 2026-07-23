import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { getGeneratedDataRoot } from "./archive"

export type PodcastLanguage = "en" | "fr"
export type PodcastProfileId = "daily-index-duo-v1" | "headline-brief-v1"
export interface PodcastVariant { locale: "en-US" | "fr-FR"; title: string; summary: string; duration_seconds: number; audio_url: string; audio_sha256: string; audio_bytes: number; mime_type: "audio/mpeg"; script_sha256: string }
export interface DailyPodcast { schema_version: "1.1.0"; publication_date: string; status: "published"; source_artifact_sha256: string; speaker_profile: PodcastProfileId; languages: Record<PodcastLanguage,PodcastVariant>; generated_at: string; published_at: string }
const HASH=/^sha256:[a-f0-9]{64}$/
// Historical episodes were produced under the retired daily-index-duo-v1 profile (4.5-6.5 min)
// and must keep displaying; new episodes use the short headline-brief-v1 profile (55-130s).
const DURATION_RANGE_SECONDS: Record<PodcastProfileId, [number, number]> = { "daily-index-duo-v1": [270, 390], "headline-brief-v1": [55, 130] }
function variant(value: unknown, language: PodcastLanguage, profile: PodcastProfileId): value is PodcastVariant {
 if (!value || typeof value!=="object") return false
 const x=value as Record<string,unknown>;const locale=language==="en"?"en-US":"fr-FR";const [minSeconds,maxSeconds]=DURATION_RANGE_SECONDS[profile]
 return x.locale===locale && typeof x.title==="string" && typeof x.summary==="string" && typeof x.duration_seconds==="number" && x.duration_seconds>=minSeconds && x.duration_seconds<=maxSeconds && typeof x.audio_url==="string" && x.audio_url.startsWith("https://tldr-assets.noisy-dew-7159.workers.dev/podcast/daily/") && x.audio_url.includes(`/${language}/`) && HASH.test(String(x.audio_sha256)) && Number.isInteger(x.audio_bytes) && Number(x.audio_bytes)>0 && x.mime_type==="audio/mpeg" && HASH.test(String(x.script_sha256))
}
export function getDailyPodcast(date:string):DailyPodcast|undefined {
 const file=path.join(getGeneratedDataRoot(),"podcast",date.slice(0,4),`${date}.json`);if(!existsSync(file))return undefined
 const x=JSON.parse(readFileSync(file,"utf8")) as DailyPodcast
 const profile=x.speaker_profile
 if(x.schema_version!=="1.1.0"||x.publication_date!==date||x.status!=="published"||!(profile in DURATION_RANGE_SECONDS)||!HASH.test(x.source_artifact_sha256)||!variant(x.languages?.en,"en",profile)||!variant(x.languages?.fr,"fr",profile))throw new Error(`Podcast artifact is invalid: ${date}`)
 return x
}
