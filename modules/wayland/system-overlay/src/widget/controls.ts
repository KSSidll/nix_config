import { createState } from "ags"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import AstalWp from "gi://AstalWp"

// volume, mute and brightness changes from keys, scrolling and sliders all go through here, so they stay in step

export const audio = AstalWp.get_default()!.audio

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

export const setVolume = (value: number) => audio.defaultSpeaker.set_volume(clamp(value))
export const changeVolume = (percent: number) => setVolume(audio.defaultSpeaker.volume + percent / 100)
export const toggleMute = (endpoint: AstalWp.Endpoint = audio.defaultSpeaker) => endpoint.set_mute(!endpoint.mute)
export const toggleMicrophone = () => toggleMute(audio.defaultMicrophone)

const decoder = new TextDecoder()
const readNumber = (path: string) => Number(decoder.decode(GLib.file_get_contents(path)[1]).trim())

// the first backlight under /sys; none on desktops with external monitors
function findBacklight() {
  try {
    const entries = Gio.File.new_for_path("/sys/class/backlight")
      .enumerate_children("standard::name", Gio.FileQueryInfoFlags.NONE, null)
    const info = entries.next_file(null)
    return info ? `/sys/class/backlight/${info.get_name()}` : null
  } catch {
    return null
  }
}

const backlight = findBacklight()
export const hasBacklight = backlight !== null
const maxBrightness = backlight ? readNumber(`${backlight}/max_brightness`) : 1

// Perceived brightness is roughly the 4th root of the backlight level (the curve `brightnessctl -e4` uses), so levels
// here are perceptual: even steps feel even, also at the dim end.
const exponent = 4
// keeps the screen visibly lit at the bottom of the range: 0.1% of the backlight's maximum
const minimum = Math.pow(0.001, 1 / exponent)

const [brightness, setBrightnessState] = createState(
  backlight ? clamp(Math.pow(readNumber(`${backlight}/brightness`) / maxBrightness, 1 / exponent)) : 0,
)
export { brightness }

// logind lets the session's own user set the backlight, without udev rules or a setuid helper
export function setBrightness(level: number) {
  if (!backlight) return
  const clamped = clamp(level, minimum)
  setBrightnessState(clamped)
  Gio.DBus.system.call(
    "org.freedesktop.login1",
    "/org/freedesktop/login1/session/auto",
    "org.freedesktop.login1.Session",
    "SetBrightness",
    new GLib.Variant("(ssu)", ["backlight", GLib.path_get_basename(backlight), Math.round(Math.pow(clamped, exponent) * maxBrightness)]),
    null,
    Gio.DBusCallFlags.NONE,
    -1,
    null,
    (connection, result) => {
      try {
        connection!.call_finish(result)
      } catch (error) {
        console.error(`Failed to set brightness [device: ${backlight}]: ${error}`)
      }
    },
  )
}

export const changeBrightness = (percent: number) => setBrightness(brightness.get() + percent / 100)
