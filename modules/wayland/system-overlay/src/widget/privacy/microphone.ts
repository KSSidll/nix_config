import { createBinding, createComputed } from "ags"
import AstalWp from "gi://AstalWp"
import { Activity, nodeApp } from "./activity"
import { links } from "./links"

const wp = AstalWp.get_default()!
const recorders = createBinding(wp.audio!, "recorders")

// the microphone a stream records from is the node linked into it
function sources(stream: AstalWp.Node) {
  const names = links()
    .filter((link) => link.to === stream.id)
    .map((link) => wp.get_node(link.from))
    .filter((node) => node !== null)
    .map((node) => node.description ?? node.name)
  return [...new Set(names)].join(", ") || undefined
}

export const microphoneUsers = createComputed((): Activity[] =>
  (recorders() ?? [])
    // a stream capturing an output's monitor (a visualizer, a recording of what's playing) doesn't listen to the room
    .filter((stream) => stream.get_pw_property("stream.capture.sink") !== "true")
    .map((stream) => ({ id: `microphone-${stream.id}`, app: nodeApp(stream), target: sources(stream) })),
)
