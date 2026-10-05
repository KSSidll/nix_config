import app from "ags/gtk4/app"
import Gdk from "gi://Gdk?version=4.0"
import Astal from "gi://Astal?version=4.0"
import Workspaces from "./Workspaces"
import Clock from "./Clock"
import Tray from "./Tray"
import Privacy from "./privacy/Privacy"
import QuickSettings from "./quicksettings/QuickSettings"
import Notifications from "./notifications/Notifications"
import { onCleanup } from "ags"
import { attachPanelHost } from "./panels"
import Media from "./media/Media"

export default function Bar({
  monitor
}: {
  monitor: Gdk.Monitor
}) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor
  attachPanelHost(monitor)

  return (
    <window
      visible
      namespace="system-overlay"
      cssClasses={["Bar"]}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      gdkmonitor={monitor}
      anchor={LEFT | TOP | RIGHT}
      application={app}
      $={(self) => onCleanup(() => self.destroy())}
    >
      <centerbox cssClasses={["bar"]}>
        <box $type="start" cssClasses={["section"]}>
          <Workspaces monitor={monitor} />
        </box>
        <box $type="center" cssClasses={["section"]}>
          <Clock />
        </box>
        <box $type="end" cssClasses={["section"]} spacing={2}>
          <Media />
          <Privacy />
          <Tray />
          <QuickSettings />
          <Notifications />
        </box>
      </centerbox>
    </window>
  )
}
