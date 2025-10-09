import { createBinding, For } from "ags"
import Gtk from "gi://Gtk?version=4.0"

import Hyprland from "gi://AstalHyprland"
const hyprland = Hyprland.get_default()
const hyprland_workspaces = createBinding(hyprland, "workspaces").as(it => it.sort((a, b) => a.id - b.id))
const hyprland_active_workspace_id = createBinding(hyprland, "focused_workspace").as(it => it.id)

export default function HyprlandWorkspaces() {
    return <box
        cssName="workspaces_box"
        valign={Gtk.Align.CENTER}
    >
        <For each={hyprland_workspaces}>
            {(item) => (
            <box>
                <box widthRequest={2} />
                <button
                    cssClasses={
                        hyprland_active_workspace_id.as(active_id =>
                            (item.id == active_id) ? ["workspace", "workspace-active"] : ["workspace"]
                        )
                    }
                    widthRequest={13}
                    heightRequest={13}
                    onClicked={() => item.focus()}
                />
                <box widthRequest={2} />
            </box>
            )}
        </For>
    </box>
}
