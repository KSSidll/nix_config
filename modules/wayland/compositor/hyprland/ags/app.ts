import { App, Gdk, Gtk } from "astal/gtk4"
import style from "./style.scss"
import Bar from "./widget/Bar"

function main() {
    const bars = new Map<Gdk.Monitor, Gtk.Widget>()

    for (const gdkMonitor of App.get_monitors()) {
        bars.set(gdkMonitor, Bar(gdkMonitor))
    }

    // App.connect("monitor-added", (_, gdkMonitor) => {
    //     bars.set(gdkMonitor, Bar(gdkMonitor))
    // })

    // App.connect("monitor-removed", (_, gdkMonitor) => {
    //     bars.get(gdkMonitor)?.unrealize()
    //     bars.delete(gdkMonitor)
    // })
}

App.start({
    css: style,
    main: main
})
