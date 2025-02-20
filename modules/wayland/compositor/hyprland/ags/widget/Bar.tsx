import { App, Astal, Gtk, Gdk } from "astal/gtk4"
import { bind, Variable } from "astal"
import Battery from "gi://AstalBattery"
import Hyprland from "gi://AstalHyprland"

const time = Variable("").poll(1000, "date +%T")
const date = Variable("").poll(1000, "date +%d.%m.%Y")

const battery = Battery.get_default()
const battery_percentage = bind(battery, "percentage").as(it => it * 100)

const hyprland = Hyprland.get_default()
const hyprland_workspaces = bind(hyprland, "workspaces").as(it => it.sort((a, b) => a.id - b.id))
const hyprland_active_workspace_id = bind(hyprland, "focused_workspace").as(it => it.id)

export default function Bar(gdkmonitor: Gdk.Monitor) {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

    return <window
        visible
        hexpand
        cssClasses={["Bar"]}
        gdkmonitor={gdkmonitor}
        exclusivity={Astal.Exclusivity.EXCLUSIVE}
        anchor={LEFT | TOP | RIGHT}
        application={App}>
        <box
            cssName="bar_overlay_box"
            orientation={Gtk.Orientation.HORIZONTAL}
        >
            <box
                cssName="bar_overlay_workspaces_box"
                orientation={Gtk.Orientation.HORIZONTAL}
                valign={Gtk.Align.CENTER}
            >
                {hyprland_workspaces.as(list => list.map(it => (
                    <box
                        cssClasses={
                            hyprland_active_workspace_id.as(active_id =>
                                (it.id == active_id) ? ["workspace", "workspace-active"] : ["workspace"]
                            )
                        }
                        widthRequest={22}
                        heightRequest={22}
                    />
                )))}
            </box>
            <box hexpand />
            <box cssName="bar_overlay_battery_box" >
                <label label={battery_percentage.as(it => `${it}%`)} />
            </box>
            <box widthRequest={20} />
            <box cssName="bar_overlay_calendar_box" >
                <menubutton>
                    <box
                        orientation={Gtk.Orientation.VERTICAL}
                        halign={Gtk.Align.CENTER}
                    >
                        <label label={time()} />
                        <box heightRequest={1} />
                        <label label={date()} />
                    </box>
                    <popover>
                        <Gtk.Calendar />
                    </popover>
                </menubutton>
            </box>
        </box>
    </window>
}
