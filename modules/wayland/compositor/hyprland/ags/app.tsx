import app from "ags/gtk4/app"
import style from "./style.scss"
import Bar from "./widget/Bar"
import { createBinding, For, This } from "ags"

function main() {
  const monitors = createBinding(app, "monitors")

  return (
    <box>
      <For each={monitors}>
        {(monitor) => <This this={app}><Bar monitor={monitor} /></This>}
      </For>
    </box>
  )
}

app.start({
  css: style,
  main: main,
})