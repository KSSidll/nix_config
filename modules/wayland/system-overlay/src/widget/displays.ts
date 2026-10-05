import app from "ags/gtk4/app"
import { createBinding, createComputed, createState } from "ags"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { prompt } from "./agents/prompt"
import { configureOutput, Output, query } from "./niri"
import { changeSetting, settings } from "./settings"

export type DisplayMode = "extend" | "mirror" | "off"

export const modeLabels: Record<DisplayMode, string> = { extend: "Extend", mirror: "Mirror", off: "Off" }

const savedModes = () => settings.get().displays as Record<string, DisplayMode>

const builtIn = (output: Output) => /^(eDP|LVDS|DSI)-/.test(output.name)

// how niri reports a display across connectors, and how its mode is saved
export const identity = (output: Output) => [output.make, output.model, output.serial].filter(Boolean).join(" ")

export const displayName = (output: Output) => output.model || output.name

const [outputs, setOutputs] = createState<Output[]>([])

// only a machine with its own panel has displays to plug in; on a desktop every display is equally its own
export const externals = createComputed(() => {
  const all = outputs()
  return all.some(builtIn) ? all.filter((it) => !builtIn(it)) : []
})

const [mirrors, setMirrors] = createState(new Map<string, Gio.Subprocess>())

export const currentMode = (output: Output) =>
  createComputed((): DisplayMode => (mirrors().has(output.name) ? "mirror" : output.logical ? "extend" : "off"))

// the preferred resolution at the fastest refresh rate the display offers
function bestMode(output: Output) {
  const preferred = output.modes.find((it) => it.is_preferred) ?? output.modes[0]
  if (!preferred) return null
  return output.modes
    .filter((it) => it.width === preferred.width && it.height === preferred.height)
    .reduce((best, it) => (it.refresh_rate > best.refresh_rate ? it : best))
}

function fastest(output: Output) {
  const best = bestMode(output)
  const current = output.current_mode === null ? null : output.modes[output.current_mode]
  if (!best || current?.refresh_rate === best.refresh_rate) return
  configureOutput(output.name, {
    Mode: { mode: { Specific: { width: best.width, height: best.height, refresh: best.refresh_rate / 1000 } } },
  })
}

function stopMirror(name: string) {
  const process = mirrors.get().get(name)
  if (!process) return
  process.send_signal(15)
  const next = new Map(mirrors.get())
  next.delete(name)
  setMirrors(next)
}

function startMirror(target: Output) {
  const source = outputs.get().find(builtIn)
  if (!source || mirrors.get().has(target.name)) return
  let process: Gio.Subprocess
  try {
    process = Gio.Subprocess.new(
      ["wl-mirror", "--fullscreen-output", target.name, source.name],
      Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE,
    )
  } catch (error) {
    console.error(`Failed to mirror [${source.name}, onto: ${target.name}]: ${error}`)
    return
  }
  setMirrors(new Map(mirrors.get()).set(target.name, process))
  // the mirror ends with its window too, closed by hand or with its display
  process.wait_async(null, () => {
    if (mirrors.get().get(target.name) !== process) return
    const next = new Map(mirrors.get())
    next.delete(target.name)
    setMirrors(next)
  })
}

// The pointer crosses only between outputs that touch, so a mirrored output is placed where none does. niri places
// an output without a set position next to the others, so the built-in one is pinned while anything is mirrored.
const isolatedX = 100_000
const isolated = new Set<string>()

function arrange() {
  const source = outputs.get().find(builtIn)
  const mirrored = [...mirrors.get().keys()]
  for (const name of [...isolated]) {
    if (mirrored.includes(name)) continue
    isolated.delete(name)
    configureOutput(name, { Position: { position: "Automatic" } })
  }
  mirrored.forEach((name, index) => {
    if (isolated.has(name)) return
    isolated.add(name)
    configureOutput(name, { Position: { position: { Specific: { x: isolatedX * (index + 1), y: 0 } } } })
  })
  if (source) {
    const position = mirrored.length > 0 ? { Specific: { x: 0, y: 0 } } : "Automatic"
    configureOutput(source.name, { Position: { position } })
  }
}

function apply(output: Output, mode: DisplayMode) {
  if (mode !== "mirror") stopMirror(output.name)
  if (mode === "off") {
    if (output.logical) configureOutput(output.name, "Off")
  } else {
    if (!output.logical) configureOutput(output.name, "On")
    fastest(output)
    if (mode === "mirror") startMirror(output)
  }
  refreshSoon()
}

export function setDisplayMode(output: Output, mode: DisplayMode) {
  changeSetting("displays", { ...savedModes(), [identity(output)]: mode })
  apply(output, mode)
}

function ask(output: Output) {
  return prompt({
    title: displayName(output),
    // the display just connected may be mirrored or off, so the question goes where the user already is
    output: outputs.get().find(builtIn)?.name,
    message: "A display was connected. How should it be used?",
    actions: (["extend", "mirror", "off"] as const).map((id) => ({ id, label: modeLabels[id] })),
    // closing the prompt leaves the display extended, as niri connects it, and asks again next time
    reply: (answer) => answer && setDisplayMode(output, answer.action as DisplayMode),
  })
}

// names of the displays handled since they connected; one that is turned off stays connected
const handled = new Set<string>()

function connected(output: Output) {
  const saved = savedModes()[identity(output)]
  if (saved) return apply(output, saved)
  fastest(output)
  return ask(output) !== null
}

async function refresh() {
  let all: Output[]
  try {
    all = Object.values(await query<Record<string, Output>>("Outputs"))
  } catch (error) {
    console.error(`Failed to read displays: ${error}`)
    return
  }
  setOutputs(all)

  const names = new Set(all.map((it) => it.name))
  for (const name of [...handled]) {
    if (names.has(name)) continue
    handled.delete(name)
    stopMirror(name)
  }
  for (const output of externals.get()) {
    if (handled.has(output.name)) continue
    // without a bar to prompt on yet, the display is handled on the next refresh
    if (connected(output) !== false) handled.add(output.name)
  }
}

// niri applies output changes after answering, so its state is read again a moment later
function refreshSoon() {
  GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
    refresh()
    return GLib.SOURCE_REMOVE
  })
}

// niri sends no event for displays, but GTK sees each one connect and disconnect
export function startDisplays() {
  createBinding(app, "monitors").subscribe(refreshSoon)
  mirrors.subscribe(arrange)
  refreshSoon()
}
