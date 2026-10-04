// Windows SAPI text-to-speech with an on-disk cache. Shared by record-video.mjs
// (to time each caption to its spoken line) and voiceover.mjs (to mix the audio).
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

export const VOICE = 'Microsoft David Desktop'
export const RATE = 2 // SAPI scale -10..10; 2 is a brisk but natural narration pace
const CACHE = new URL('../media/voice-cache/', import.meta.url)
const path = (u) => decodeURIComponent(u.pathname).replace(/^\/([A-Z]:)/, '$1')

/** Written caption -> words a speech engine reads naturally. */
export const speakable = (t) => t
  .replace(/g\/cm³/g, 'grams per cubic centimetre')
  .replace(/M sin i|M\*sin\(i\)/g, 'M sine i')
  .replace(/\bMCP\b/g, 'M C P').replace(/\bGROQ\b/g, 'grock').replace(/\bCI\b/g, 'C I')
  .replace(/\bet al\./g, 'et al').replace(/&/g, 'and').replace(/\+/g, 'and')
  .replace(/\bONE\b/g, 'one').replace(/\bCALCULATED\b/g, 'calculated')
  .replace(/Kepler-139 d/g, 'Kepler 139 d').replace(/Proxima Cen b/g, 'Proxima Centauri b')
  .replace(/[“”"…]/g, '').replace(/’/g, "'").replace(/\s+/g, ' ').trim()

export function audioSeconds(file) {
  return parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout)
}

/** Returns { wav, seconds } for a caption, synthesizing once and caching by content. */
export function synth(caption, rate = RATE) {
  mkdirSync(CACHE, { recursive: true })
  const text = speakable(caption)
  const key = createHash('sha1').update(`${VOICE}|${rate}|${text}`).digest('hex').slice(0, 16)
  const wav = path(new URL(`${key}.wav`, CACHE))
  if (!existsSync(wav)) {
    const txt = path(new URL(`${key}.txt`, CACHE))
    const ps1 = path(new URL('say.ps1', CACHE))
    writeFileSync(txt, text)
    writeFileSync(ps1, [
      'param([string]$TextFile, [string]$WavFile, [int]$Rate)',
      'Add-Type -AssemblyName System.Speech',
      '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
      `$s.SelectVoice('${VOICE}')`,
      '$s.Rate = $Rate',
      '$s.SetOutputToWaveFile($WavFile)',
      '$s.Speak([IO.File]::ReadAllText($TextFile))',
      '$s.Dispose()',
    ].join('\n'))
    const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-TextFile', txt, '-WavFile', wav, '-Rate', String(rate)], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`TTS failed: ${r.stderr}`)
  }
  return { wav, seconds: audioSeconds(wav) }
}
