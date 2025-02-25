import { bind } from "astal"
import { Gtk } from "astal/gtk4"

import Hyprland from "gi://AstalHyprland"
const hyprland = Hyprland.get_default()
const hyprland_workspaces = bind(hyprland, "workspaces").as(it => it.sort((a, b) => a.id - b.id))
const hyprland_active_workspace_id = bind(hyprland, "focused_workspace").as(it => it.id)

export default function HyprlandWorkspaces() {
    return <box
        cssName="workspaces_box"
        valign={Gtk.Align.CENTER}
    >
        {hyprland_workspaces.as(list => list.map(it => (
            <box>
                <box widthRequest={2} />
                <button
                    cssClasses={
                        hyprland_active_workspace_id.as(active_id =>
                            (it.id == active_id) ? ["workspace", "workspace-active"] : ["workspace"]
                        )
                    }
                    widthRequest={13}
                    heightRequest={13}
                    onClicked={_ => it.focus()}
                />
                <box widthRequest={2} />
            </box>
        )))}
    </box>
}
