import { createBinding } from "ags"
import PowerProfiles from "gi://AstalPowerProfiles"
import Tile from "./Tile"

const names: Record<string, string> = {
  "power-saver": "Power saver",
  balanced: "Balanced",
  performance: "Performance",
}

export function PowerProfileTile() {
  const profiles = PowerProfiles.get_default()
  const active = createBinding(profiles, "activeProfile")

  const cycle = () => {
    const available = profiles.get_profiles().map((it) => it.profile)
    profiles.activeProfile = available[(available.indexOf(profiles.activeProfile) + 1) % available.length]
  }

  return (
    <Tile
      icon={createBinding(profiles, "iconName")}
      title="Power mode"
      subtitle={active.as((it) => names[it] ?? it)}
      active={active.as((it) => it !== "balanced")}
      onToggle={cycle}
    />
  )
}
