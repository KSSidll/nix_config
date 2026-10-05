import { execAsync } from "ags/process"
import { changeSetting, settings } from "../settings"
import Tile from "./Tile"

// wlsunset follows sunset and sunrise by itself; the tile only decides whether it runs
const service = "wlsunset.service"

export function NightLightTile() {
  const on = settings.as((it) => it.nightLight)

  const toggle = () => {
    const next = !settings.get().nightLight
    // the service checks the stored setting before it starts, so it is written first
    changeSetting("nightLight", next)
    execAsync(["systemctl", "--user", next ? "start" : "stop", service]).catch((error) =>
      console.error(`Failed to ${next ? "start" : "stop"} night light [${service}]: ${error}`),
    )
  }

  return (
    <Tile
      icon="weather-clear-night-symbolic"
      title="Night light"
      subtitle={on.as((it) => (it ? "Sunset to sunrise" : "Off"))}
      active={on}
      onToggle={toggle}
    />
  )
}
