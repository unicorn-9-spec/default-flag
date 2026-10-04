// Mixes a male text-to-speech voiceover (Windows SAPI, "Microsoft David") into the
// recorded walkthrough: one clip per caption, starting at that caption's time.
//   node scripts/voiceover.mjs
// Reads media/default-flag-walkthrough.{mp4,srt}; writes media/default-flag-walkthrough-voiced.mp4.
// record-video.mjs already holds each caption for its spoken length, so clips never overlap.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { audioSeconds, synth } from './tts.mjs'

const MEDIA = new URL('../media/', import.meta.url)
const p = (name) => decodeURIComponent(new URL(name, MEDIA).pathname).replace(/^\/([A-Z]:)/, '$1')

const toMs = (t) => { const [h, m, s] = t.split(':'); return (+h * 3600 + +m * 60 + parseFloat(s.replace(',', '.'))) * 1000 }
const cues = readFileSync(new URL('default-flag-walkthrough.srt', MEDIA), 'utf8').trim().split(/\r?\n\r?\n/).map((block) => {
  const [, times, ...text] = block.split(/\r?\n/)
  const [a, b] = times.split(' --> ')
  return { start: toMs(a), end: toMs(b), text: text.join(' ') }
})

let overlaps = 0
const clips = cues.map((cue, i) => {
  const { wav, seconds } = synth(cue.text)
  const slot = (cue.end - cue.start) / 1000
  if (seconds > slot + 0.05) overlaps++
  console.log(`${String(i + 1).padStart(2)}  ${(cue.start / 1000).toFixed(1).padStart(6)}s  voice ${seconds.toFixed(1)}s / caption ${slot.toFixed(1)}s`)
  return { wav, start: cue.start }
})

const inputs = clips.flatMap((c) => ['-i', c.wav])
const filter = clips.map((c, i) => `[${i + 1}:a]adelay=${Math.round(c.start)}|${Math.round(c.start)},apad[a${i}]`).join(';') +
  `;${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0:duration=longest,volume=1.6[voice]`
const out = p('default-flag-walkthrough-voiced.mp4')
const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', p('default-flag-walkthrough.mp4'), ...inputs, '-filter_complex', filter,
  '-map', '0:v', '-map', '[voice]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', out], { stdio: 'inherit' })
if (ff.status !== 0) throw new Error('ffmpeg mix failed')
console.log(`voiced video: media/default-flag-walkthrough-voiced.mp4 (${audioSeconds(out).toFixed(1)} s); overlapping lines: ${overlaps}`)
