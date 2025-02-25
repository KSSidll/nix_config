import { App, Astal, Gdk } from "astal/gtk4"
import BatteryLevel from "./BatteryLevel"
import HyprlandWorkspaces from "./HyprlandWorkspaces"
import Calendar from "./Calendar"

export default function Bar(gdkmonitor: Gdk.Monitor) {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

    return <window
        visible
        hexpand
        cssClasses={["Bar"]}
        gdkmonitor={gdkmonitor}
        exclusivity={Astal.Exclusivity.EXCLUSIVE}
        anchor={LEFT | TOP | RIGHT}
        application={App}
    >
        <box
            cssName="bar_overlay_box"
        >
            <HyprlandWorkspaces />
            <box hexpand />
            <box cssName="pill">
                <BatteryLevel />
                <box widthRequest={12} />
                <Calendar />
            </box>
        </box>
    </window>
}
