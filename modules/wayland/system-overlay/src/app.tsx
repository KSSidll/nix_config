import app from "ags/gtk4/app"
import style from "./style.scss"
import Bar from "./widget/Bar"
import NotificationPopups from "./widget/notifications/NotificationPopups"
import Osd from "./widget/osd/Osd"
import { handleRequest } from "./widget/requests"
import { startBluetoothAgent } from "./widget/agents/bluetooth"
import { startNetworkAgent } from "./widget/agents/network"
import { startPolkitAgent } from "./widget/agents/polkit"
import { launcher, widgets } from "./config"
import { startDisplays } from "./widget/displays"
import LauncherScrim from "./widget/launcher"
import { startMedia } from "./widget/media/state"
import { startBatteryWarnings } from "./widget/battery-warnings"
import { startFailureNotifications } from "./widget/failures"
import { createBinding, For, This } from "ags"

function main() {
  startNetworkAgent()
  startPolkitAgent()
  if (widgets.bluetooth) startBluetoothAgent()
  startDisplays()
  startMedia()
  if (widgets.battery) startBatteryWarnings()
  startFailureNotifications()
  const monitors = createBinding(app, "monitors")

  return (
    <For each={monitors}>
      {(monitor) => (
        <This this={app}>
          <Bar monitor={monitor} />
          <NotificationPopups monitor={monitor} />
          <Osd monitor={monitor} />
          {launcher && <LauncherScrim monitor={monitor} />}
        </This>
      )}
    </For>
  )
}

app.start({
  css: style,
  main: main,
  requestHandler: (argv, respond) => {
    try {
      respond(handleRequest(argv))
    } catch (error) {
      console.error(`Request failed [${argv.join(" ")}]: ${error}`)
      respond(`error: ${error}`)
    }
  },
})