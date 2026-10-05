import app from "ags/gtk4/app"
import { createState, onCleanup } from "ags"
import GLib from "gi://GLib"
import Gdk from "gi://Gdk?version=4.0"
import Gtk from "gi://Gtk?version=4.0"
import Astal from "gi://Astal?version=4.0"
import { launcher } from "../config"
import { action, focusedOutput, query } from "./niri"

type Layer = { namespace: string; output: string }

// the output dimmed behind the open launcher
const [dimmed, setDimmed] = createState<string | null>(null)

const launcherLayer = async () =>
  (await query<Layer[]>("Layers")).find((it) => it.namespace === launcher.namespace) ?? null

const spawn = (command: string[]) => action({ Spawn: { command } })

const sleep = (ms: number) =>
  new Promise<void>((resolve) =>
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
      resolve()
      return GLib.SOURCE_REMOVE
    }),
  )

const pollInterval = 100
const appearTimeout = 2000
let watch = 0

// niri sends no events for layer surfaces, so the dim looks for the launcher's surface until it appears and then
// until it is gone, however it closed
async function dimWhileOpen(id: number) {
  try {
    let seen = false
    for (let waited = 0; id === watch; waited += pollInterval) {
      const layer = await launcherLayer()
      if (id !== watch) return
      if (layer) {
        seen = true
        setDimmed(layer.output)
      } else if (seen || waited >= appearTimeout) {
        break
      }
      await sleep(pollInterval)
    }
  } finally {
    if (id === watch) setDimmed(null)
  }
}

export async function toggleLauncher() {
  if (await launcherLayer()) return spawn(launcher.close)
  setDimmed(focusedOutput.get())
  spawn(launcher.open)
  await dimWhileOpen(++watch)
}

// below the bar like a modal panel's dim; it takes no keyboard, which stays with the launcher
export default function LauncherScrim({ monitor }: { monitor: Gdk.Monitor }) {
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
  return (
    <window
      visible={dimmed.as((it) => it === monitor.connector)}
      namespace="system-overlay-scrim"
      cssClasses={["Scrim"]}
      gdkmonitor={monitor}
      layer={Astal.Layer.TOP}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      exclusivity={Astal.Exclusivity.NORMAL}
      keymode={Astal.Keymode.NONE}
      application={app}
      $={(self) => onCleanup(() => self.destroy())}
    >
      <Gtk.GestureClick button={0} onPressed={() => spawn(launcher.close)} />
    </window>
  )
}
