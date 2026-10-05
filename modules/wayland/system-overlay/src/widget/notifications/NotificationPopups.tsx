import app from "ags/gtk4/app"
import { createComputed, For, onCleanup } from "ags"
import Gdk from "gi://Gdk?version=4.0"
import Gtk from "gi://Gtk?version=4.0"
import Astal from "gi://Astal?version=4.0"
import { geometry } from "../../config"
import { focusedOutput } from "../niri"
import { openSpan } from "../panels"
import NotificationCard, { popupWidth } from "./NotificationCard"
import { popups } from "./state"

export default function NotificationPopups({ monitor }: { monitor: Gdk.Monitor }) {
  const { TOP, RIGHT } = Astal.WindowAnchor
  const focused = focusedOutput.as((it) => it === monitor.connector)
  // held while an open panel or menu reaches into their column, so they never cover it
  const covered = openSpan.as((span) => span?.monitor === monitor && span.end > monitor.geometry.width - popupWidth - geometry.gap)

  return (
    <window
      visible={createComputed(() => focused() && popups().length > 0 && !covered())}
      namespace="system-overlay-notifications"
      cssClasses={["NotificationPopups"]}
      gdkmonitor={monitor}
      anchor={TOP | RIGHT}
      exclusivity={Astal.Exclusivity.NORMAL}
      application={app}
      $={(self) => onCleanup(() => self.destroy())}
    >
      <box cssClasses={["popups"]} orientation={Gtk.Orientation.VERTICAL} spacing={8}>
        <For each={popups}>{(notification) => <NotificationCard notification={notification} popup />}</For>
      </box>
    </window>
  )
}
