import { audio, changeBrightness, changeVolume, hasBacklight, toggleMicrophone, toggleMute } from "./controls"
import { showOsd } from "./osd/state"
import { toggleLauncher } from "./launcher"
import { launcher } from "../config"
import { control, MediaCommand } from "./media/state"

const step = 5

// commands for hardware keys, sent over the app's D-Bus Request method; returns the reply text
export function handleRequest(argv: string[]): string {
  const command = argv.join(" ")
  switch (command) {
    case "volume up":
    case "volume down":
      audio.defaultSpeaker.set_mute(false)
      changeVolume(command === "volume up" ? step : -step)
      showOsd("volume")
      return "ok"
    case "volume mute":
      toggleMute()
      showOsd("volume")
      return "ok"
    case "microphone mute":
      toggleMicrophone()
      showOsd("microphone")
      return "ok"
    case "brightness up":
    case "brightness down":
      if (!hasBacklight) return "no backlight"
      changeBrightness(command === "brightness up" ? step : -step)
      showOsd("brightness")
      return "ok"
    case "media play-pause":
    case "media next":
    case "media previous":
      if (!control(argv[1] as MediaCommand)) return "no player"
      showOsd("media")
      return "ok"
    case "launcher":
      if (!launcher) return "no launcher"
      toggleLauncher().catch((error) => console.error(`Failed to toggle the launcher: ${error}`))
      return "ok"
    default:
      return `unknown request [${command}]`
  }
}
