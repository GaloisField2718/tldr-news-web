"use client"
import { useEffect,useState } from "react"
import type { DailyPodcast,PodcastLanguage } from "@/lib/podcast"
const KEY="daily-index-podcast-language"
export function preferredPodcastLanguage(stored:string|null,browserLanguage:string):PodcastLanguage {
 if(stored==="en"||stored==="fr")return stored
 return browserLanguage.toLowerCase().startsWith("fr")?"fr":"en"
}
export function PodcastPlayer({podcast}:{podcast:DailyPodcast}) {
 const [language,setLanguage]=useState<PodcastLanguage>("en")
 useEffect(()=>{const id=setTimeout(()=>setLanguage(preferredPodcastLanguage(localStorage.getItem(KEY),navigator.language)));return ()=>clearTimeout(id)},[])
 function select(value:PodcastLanguage){setLanguage(value);localStorage.setItem(KEY,value)}
 const episode=podcast.languages[language]
 return <section className="podcast-player" aria-labelledby="podcast-title">
  <div className="podcast-heading"><p className="podcast-kicker">Daily podcast</p><div role="group" aria-label="Podcast language" className="podcast-language"><button type="button" aria-pressed={language==="en"} onClick={()=>select("en")}>English</button><button type="button" aria-pressed={language==="fr"} onClick={()=>select("fr")}>Français</button></div></div>
  <h2 id="podcast-title">{episode.title}</h2><p>{episode.summary}</p>
  <audio key={episode.audio_url} controls preload="metadata" aria-label={`${episode.title} — ${episode.locale}`} src={episode.audio_url}>Your browser does not support audio playback.</audio>
 </section>
}
