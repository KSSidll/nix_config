import { createBinding, createComputed } from "ags"
import Battery from "gi://AstalBattery"

export function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`
}

export function batteryStatus() {
  const battery = Battery.get_default()
  const percentage = createBinding(battery, "percentage").as((it) => Math.round(it * 100))
  const charging = createBinding(battery, "charging")
  const state = createBinding(battery, "state")
  const timeToFull = createBinding(battery, "timeToFull")
  const timeToEmpty = createBinding(battery, "timeToEmpty")
  const energyRate = createBinding(battery, "energyRate")

  const warning = createBinding(battery, "warningLevel")

  const level = createComputed(() => {
    if (charging()) return ["charging"]
    if (warning() >= Battery.WarningLevel.LOW) return ["critical"]
    if (percentage() <= 40) return ["low"]
    return []
  })

  const status = createComputed(() => {
    switch (state()) {
      case Battery.State.CHARGING:
        return timeToFull() > 0 ? `Full in ${duration(timeToFull())}` : "Charging"
      case Battery.State.DISCHARGING:
        return timeToEmpty() > 0 ? `${duration(timeToEmpty())} remaining` : "Discharging"
      case Battery.State.FULLY_CHARGED:
        return "Fully charged"
      case Battery.State.PENDING_CHARGE:
        return "Plugged in, not charging"
      default:
        return "Unknown state"
    }
  })

  return {
    icon: createBinding(battery, "batteryIconName"),
    percentage: percentage.as((it) => `${it}%`),
    level,
    status,
    power: energyRate.as((it) => (it > 0 ? `${it.toFixed(1)} W` : "")),
  }
}
