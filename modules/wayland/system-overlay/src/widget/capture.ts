import { createState } from "ags"
import { execAsync } from "ags/process"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { recordings } from "../config"
import { prompt } from "./agents/prompt"
import { audio } from "./controls"
import { showInFiles } from "./files"
import { action, focusedOutput, onScreenshot, query, Window } from "./niri"
import { notify } from "./notifications/send"
import { closePanel, launch } from "./panels"

Gio._promisify(Gio.Subprocess.prototype, "communicate_utf8_async", "communicate_utf8_finish")

// long enough for a closing panel to leave the screen before it is captured
const settleMs = 300

function afterPanelCloses(run: () => void) {
  closePanel()
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, settleMs, () => {
    run()
    return GLib.SOURCE_REMOVE
  })
}

// niri saves screenshots to its screenshot-path and copies them to the clipboard
export function screenshot(kind: "select" | "screen" | "window") {
  afterPanelCloses(() => {
    if (kind === "select") action({ Screenshot: { show_pointer: false, path: null } })
    else if (kind === "screen") action({ ScreenshotScreen: { write_to_disk: true, show_pointer: false, path: null } })
    // niri lets the user click the window; Escape picks none
    else
      query<Window | null>("PickWindow", "PickedWindow")
        .then((window) => window && action({ ScreenshotWindow: { id: window.id, write_to_disk: true, show_pointer: false, path: null } }))
        .catch((error: unknown) => console.error(`Failed to pick a window to screenshot: ${error}`))
  })
}

function screenshotTaken(path: string | null) {
  notify({
    app: "Screenshot",
    icon: "camera-photo-symbolic",
    summary: path ? "Screenshot saved" : "Screenshot copied",
    body: path ? GLib.path_get_basename(path) : "It's in the clipboard.",
    image: path ?? undefined,
    actions: path
      ? [
          { id: "open", label: "Open", run: () => launch("xdg-open", path) },
          // satty's config saves back to the file and copies the result
          { id: "annotate", label: "Annotate", run: () => launch("satty", "--filename", path, "--output-filename", path) },
          { id: "show", label: "Show in Files", run: () => showInFiles(path) },
        ]
      : [],
  }).catch((error: unknown) => console.error(`Failed to report a screenshot [path: ${path}]: ${error}`))
}

export function startScreenshotNotifications() {
  onScreenshot(screenshotTaken)
}

type Recording = { process: Gio.Subprocess; pid: number; started: number; target: string }

const [recording, setRecording] = createState<Recording | null>(null)
export { recording }

const [elapsed, setElapsed] = createState(0)
export { elapsed }

export const formatElapsed = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

type Audio = "system" | "microphone" | "none"

// wf-recorder names sources as PulseAudio does: by their PipeWire node name, with a speaker's output captured from
// its monitor source
function audioArgs(source: Audio) {
  if (source === "none") return []
  const node = source === "system" ? audio.defaultSpeaker : audio.defaultMicrophone
  const name = node.get_pw_property("node.name")
  if (!name) throw new Error(`no node name for the default ${source === "system" ? "speaker" : "microphone"}`)
  return [`--audio=${name}${source === "system" ? ".monitor" : ""}`]
}

function record(area: { output: string } | { region: string }, source: Audio) {
  const name = GLib.DateTime.new_now_local().format("Recording from %Y-%m-%d %H-%M-%S.mp4")
  const file = `${recordings}/${name}`
  const target = "output" in area ? (area.output.startsWith("eDP") ? "Built-in display" : area.output) : "Region"
  let process: Gio.Subprocess
  try {
    const argv = [
      "wf-recorder",
      "--file", file,
      ...("output" in area ? ["--output", area.output] : ["--geometry", area.region]),
      ...audioArgs(source),
    ]
    GLib.mkdir_with_parents(recordings, 0o755)
    process = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_PIPE)
  } catch (error) {
    console.error(`Failed to start recording [${file}]: ${error}`)
    return
  }

  const current = { process, pid: Number(process.get_identifier()), started: GLib.get_monotonic_time(), target }
  setRecording(current)
  setElapsed(0)
  const tick = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
    setElapsed(Math.floor((GLib.get_monotonic_time() - current.started) / 1_000_000))
    return GLib.SOURCE_CONTINUE
  })

  // stderr is read to the end, so the process is waited on and its last words are at hand if it fails
  const finished = process.communicate_utf8_async(null, null) as unknown as Promise<[boolean, string | null, string | null]>
  finished
    .then(([, , stderr]) => {
      if (!process.get_successful()) {
        const tail = (stderr ?? "").trim().split("\n").slice(-3).join(" | ")
        console.error(`Recording failed [${file}, status: ${process.get_status()}]: ${tail}`)
      }
    })
    .catch((error: unknown) => console.error(`Recording failed [${file}]: ${error}`))
    .finally(() => {
      GLib.source_remove(tick)
      setRecording(null)
    })
}

// SIGINT lets wf-recorder finish writing the file; a harder stop leaves it unplayable
export function stopRecording() {
  recording.get()?.process.send_signal(2)
}

export function startRecording(area: "screen" | "region") {
  if (recording.get()) return
  closePanel()
  prompt({
    title: "Screen recording",
    message: "Record with which audio?",
    actions: [
      { id: "system", label: "System audio" },
      // a muted microphone records silence
      { id: "microphone", label: audio.defaultMicrophone.mute ? "Microphone (muted)" : "Microphone" },
      { id: "none", label: "No audio" },
    ],
    reply: (answer) => {
      if (!answer) return
      const source = answer.action as Audio
      afterPanelCloses(() => {
        if (area === "screen") {
          const output = focusedOutput.get()
          if (output) record({ output }, source)
          return
        }
        // slurp exits with an error when the selection is cancelled with Escape
        execAsync(["slurp"])
          .then((region) => record({ region: region.trim() }, source))
          .catch(() => {})
      })
    },
  })
}
