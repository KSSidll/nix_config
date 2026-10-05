import { For } from "ags"
import Gdk from "gi://Gdk?version=4.0"
import Gtk from "gi://Gtk?version=4.0"
import { action, workspaces } from "./niri"
import { scrollSteps } from "./scroll"

// niri keeps workspaces per output, with an empty one below the last; empty ones show only while active
export default function Workspaces({ monitor }: { monitor: Gdk.Monitor }) {
  const own = workspaces.as((all) => all.filter((it) => it.output === monitor.connector).sort((a, b) => a.idx - b.idx))
  const shown = own.as((all) => all.filter((it) => it.active_window_id !== null || it.is_active))

  const focus = (id: number) => action({ FocusWorkspace: { reference: { Id: id } } })
  const step = (steps: number) => {
    const all = own.get()
    const next = all[all.findIndex((it) => it.is_active) + (steps > 0 ? 1 : -1)]
    if (next) focus(next.id)
  }

  return (
    <box cssClasses={["workspaces"]}>
      {scrollSteps({ perNotch: 1, pixelsPerStep: 30, oncePerGesture: true, onSteps: step })}
      <For each={shown}>
        {(workspace) => (
          <button cssClasses={["workspace-target"]} tooltipText={workspace.name ?? `${workspace.idx}`} onClicked={() => focus(workspace.id)}>
            <box
              valign={Gtk.Align.CENTER}
              cssClasses={[
                "workspace",
                ...(workspace.is_active ? ["active"] : []),
                ...(workspace.is_urgent ? ["urgent"] : []),
              ]}
            />
          </button>
        )}
      </For>
    </box>
  )
}
