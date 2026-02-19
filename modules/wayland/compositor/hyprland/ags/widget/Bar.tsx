import app from "ags/gtk4/app"
import Gdk from "gi://Gdk?version=4.0"
import Astal from "gi://Astal"
import BatteryLevel from "./BatteryLevel"
import HyprlandWorkspaces from "./HyprlandWorkspaces"
import Calendar from "./Calendar"
import { onCleanup } from "ags"

export default function Bar({
  monitor
}: {
  monitor: Gdk.Monitor
}) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  return (
    <window
      visible
      hexpand
      cssClasses={["Bar"]}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      gdkmonitor={monitor}
      anchor={LEFT | TOP | RIGHT}
      application={app}
      $={(self) => onCleanup(() => self.destroy())}
    >
      <box cssName="bar_overlay_box">
        <HyprlandWorkspaces />
        <box hexpand />
        <box cssName="pill">
          <BatteryLevel />
          <box widthRequest={12} />
          <Calendar />
        </box>
      </box>
    </window>
  )
}
