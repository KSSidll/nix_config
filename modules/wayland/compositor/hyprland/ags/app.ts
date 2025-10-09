import app from "ags/gtk4/app"
import style from "./style.scss"
import Bar from "./widget/Bar"

function main() {
  for (const gdkMonitor of app.get_monitors()) {
    Bar(gdkMonitor)
  }

  // App.connect("monitor-added", (_, gdkMonitor) => {
  //     bars.set(gdkMonitor, Bar(gdkMonitor))
  // })

  // App.connect("monitor-removed", (_, gdkMonitor) => {
  //     bars.get(gdkMonitor)?.unrealize()
  //     bars.delete(gdkMonitor)
  // })
}

app.start({
  css: style,
  main: main
})
