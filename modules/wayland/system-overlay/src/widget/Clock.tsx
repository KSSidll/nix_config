import { createPoll } from "ags/time"
import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=4.0"
import Panel from "./Panel"
import PanelButton from "./PanelButton"

export default function Clock() {
  const now = createPoll(GLib.DateTime.new_now_local(), 1000, () => GLib.DateTime.new_now_local())

  return (
    <PanelButton
      cssClasses={["clock"]}
      panel={() => (
        <Panel title={now.as((it) => it.format("%A, %-d %B %Y")!)}>
          <Gtk.Calendar halign={Gtk.Align.CENTER} />
        </Panel>
      )}
    >
      <box spacing={8}>
        <label label={now.as((it) => it.format("%H:%M")!)} />
        <label cssClasses={["date"]} label={now.as((it) => it.format("%d/%m")!)} />
      </box>
    </PanelButton>
  )
}
