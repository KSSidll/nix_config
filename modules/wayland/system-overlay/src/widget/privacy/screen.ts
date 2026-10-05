import { createBinding, createComputed, createState } from "ags"
import AstalWp from "gi://AstalWp"
import { elapsed, formatElapsed, recording, stopRecording } from "../capture"
import { action, Cast, casts, query, Window } from "../niri"
import { Activity, nodeApp, processApp, unknownApp } from "./activity"
import { links } from "./links"

const wp = AstalWp.get_default()!

const [windows, setWindows] = createState<Window[]>([])
casts.subscribe(() => {
  if (!casts.get().some((cast) => "Window" in cast.target)) return
  query<Window[]>("Windows")
    .then(setWindows)
    .catch((error) => console.error(`[privacy] couldn't read window titles: ${error}`))
})

// receiving nodes show up in AstalWp's video recorders, sometimes after their link does
const recorders = createBinding(wp.video!, "recorders")

// niri knows what each screencast captures but not who receives it; for a PipeWire cast that's whoever is linked to
// its stream
function receivers(cast: Cast) {
  if (cast.kind === "WlrScreencopy") return cast.pid === null ? [] : [processApp(cast.pid)]
  return links()
    .filter((link) => link.from === cast.pw_node_id)
    .map((link) => wp.get_node(link.to))
    .filter((node) => node !== null)
    .map(nodeApp)
}

function targetName(target: Cast["target"]) {
  if ("Output" in target) return target.Output.name.startsWith("eDP") ? "Built-in display" : target.Output.name
  if ("Window" in target) return windows().find((it) => it.id === target.Window.id)?.title ?? "A window"
  return "Nothing yet"
}

export const screenShares = createComputed((): Activity[] => {
  recorders()
  const sessions = new Map<number, Cast[]>()
  // the overlay's own recording is listed apart, by screenRecordings
  const own = recording()?.pid
  for (const cast of casts().filter((it) => own === undefined || it.pid !== own)) sessions.set(cast.session_id, [...(sessions.get(cast.session_id) ?? []), cast])
  return [...sessions].map(([session, streams]) => ({
    id: `screen-${session}`,
    app: [...new Set(streams.flatMap(receivers))].join(", ") || unknownApp,
    target: [...new Set(streams.map((cast) => targetName(cast.target)))].join(", "),
    // niri can stop only PipeWire casts; a wlr-screencopy one lasts as long as its app keeps capturing
    action: streams.every((cast) => cast.kind === "PipeWire")
      ? { label: "Stop", run: () => action({ StopCast: { session_id: session } }) }
      : undefined,
  }))
})

export const screenRecordings = createComputed((): Activity[] => {
  const current = recording()
  if (!current) return []
  return [
    {
      id: `recording-${current.pid}`,
      app: "Screen recording",
      target: `${current.target} · ${formatElapsed(elapsed())}`,
      action: { label: "Stop", run: stopRecording },
    },
  ]
})
