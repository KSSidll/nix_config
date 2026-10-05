import Battery from "gi://AstalBattery"
import { battery as config } from "../config"
import { closeNotification, notify, Urgency } from "./notifications/send"
import { duration } from "./quicksettings/battery"

const { LOW, CRITICIAL } = Battery.WarningLevel

// each level replaces the previous warning, and plugging in withdraws it
let shown = 0

async function warn(summary: string, body: string, urgency: number) {
  shown = await notify({ app: "Battery", icon: "battery-caution-symbolic", summary, body, urgency, replaces: shown })
}

async function withdraw() {
  if (shown === 0) return
  const id = shown
  shown = 0
  await closeNotification(id)
}

function show(device: Battery.Device, level: Battery.WarningLevel) {
  const percentage = `${Math.round(device.percentage * 100)}%`
  const remaining = device.timeToEmpty > 0 ? `, about ${duration(device.timeToEmpty)}` : ""
  const done =
    level >= CRITICIAL
      ? warn("Battery critical", `${percentage} left. Plug in now: the laptop sleeps at ${config.sleepsAt}%.`, Urgency.critical)
      : level === LOW
        ? warn("Battery low", `${percentage} left${remaining}.`, Urgency.normal)
        : withdraw()
  done.catch((error) => console.error(`Failed to update the battery warning [level: ${level}]: ${error}`))
}

export function startBatteryWarnings() {
  const device = Battery.get_default()
  const update = () => show(device, device.warningLevel)
  device.connect("notify::warning-level", update)
  update()
}
