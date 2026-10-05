import { createState } from "ags"
import { execAsync } from "ags/process"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=4.0"
import { idle } from "../../config"
import Panel from "../Panel"
import Tile from "./Tile"

type Settings = { dim: number; lock: number; screenOff: number; suspend: number; suspendOnAC: boolean }
type Timing = "dim" | "lock" | "screenOff" | "suspend"

const timings: { key: Timing; label: string }[] = [
  { key: "dim", label: "Dim screen" },
  { key: "lock", label: "Lock" },
  { key: "screenOff", label: "Screen off" },
  { key: "suspend", label: "Suspend" },
]

// the hypridle variables the nix config defines and its overrides file redefines
const variables: Record<keyof Settings, string> = {
  dim: "idle_dim",
  lock: "idle_lock",
  screenOff: "idle_screen_off",
  suspend: "idle_suspend",
  suspendOnAC: "idle_suspend_on_ac",
}

const defaults: Settings = {
  dim: idle.dim,
  lock: idle.lock,
  screenOff: idle.screenOff,
  suspend: idle.suspend,
  suspendOnAC: idle.suspendOnAC,
}

const minute = 60
const maxMinutes = 60
const applyDelayMs = 1000

function readOverrides(): Partial<Settings> {
  let text: string
  try {
    text = new TextDecoder().decode(GLib.file_get_contents(idle.overrides)[1])
  } catch {
    return {}
  }
  const overrides: Partial<Settings> = {}
  for (const [key, variable] of Object.entries(variables) as [keyof Settings, string][]) {
    const match = text.match(new RegExp(`^\\$${variable}\\s*=\\s*(\\d+)\\s*$`, "m"))
    if (!match) continue
    const value = Number(match[1])
    if (key === "suspendOnAC") overrides.suspendOnAC = value === 1
    else overrides[key] = value
  }
  return overrides
}

const [settings, setSettings] = createState<Settings>({ ...defaults, ...readOverrides() })
let pendingApply: number | null = null

// hypridle reads its timings only at startup, so a change rewrites the overrides and restarts it once edits settle
function apply() {
  const current = settings.get()
  const lines = (Object.keys(variables) as (keyof Settings)[])
    .filter((key) => current[key] !== defaults[key])
    .map((key) => `$${variables[key]} = ${Number(current[key])}\n`)
  try {
    if (lines.length > 0) {
      GLib.mkdir_with_parents(GLib.path_get_dirname(idle.overrides), 0o755)
      GLib.file_set_contents(idle.overrides, lines.join(""))
    } else {
      GLib.unlink(idle.overrides)
    }
  } catch (error) {
    console.error(`Failed to write idle overrides [${idle.overrides}]: ${error}`)
    return
  }
  execAsync(["systemctl", "--user", "restart", "hypridle.service"])
    .catch((error) => console.error(`Failed to restart hypridle: ${error}`))
}

function update(change: Partial<Settings>) {
  setSettings({ ...settings.get(), ...change })
  if (pendingApply !== null) GLib.source_remove(pendingApply)
  pendingApply = GLib.timeout_add(GLib.PRIORITY_DEFAULT, applyDelayMs, () => {
    pendingApply = null
    apply()
    return GLib.SOURCE_REMOVE
  })
}

// steps a minute at a time up to an hour, then to never
function step(value: number, direction: 1 | -1) {
  if (value === idle.never) return direction > 0 ? idle.never : maxMinutes * minute
  const next = value + direction * minute
  if (next > maxMinutes * minute) return idle.never
  return Math.max(minute, next)
}

const describe = (value: number) => (value === idle.never ? "Never" : `${Math.round(value / minute)} min`)

const [keepAwake, setKeepAwake] = createState(false)
let inhibitor: number | null = null
let requesting = false

// a logind idle inhibitor is a file descriptor: hypridle pauses while one is open, and it closes with the bar if the
// bar crashes or restarts, so keep awake can't outlive it
function toggleKeepAwake() {
  if (requesting) return
  if (inhibitor !== null) {
    GLib.close(inhibitor)
    inhibitor = null
    setKeepAwake(false)
    return
  }
  requesting = true
  Gio.DBus.system.call_with_unix_fd_list(
    "org.freedesktop.login1",
    "/org/freedesktop/login1",
    "org.freedesktop.login1.Manager",
    "Inhibit",
    new GLib.Variant("(ssss)", ["idle", "System overlay", "Keep awake", "block"]),
    new GLib.VariantType("(h)"),
    Gio.DBusCallFlags.NONE,
    -1,
    null,
    null,
    (connection, result) => {
      requesting = false
      try {
        const [reply, fdList] = connection!.call_with_unix_fd_list_finish(result)
        const fds = fdList!.steal_fds()
        const index = reply.get_child_value(0).get_handle()
        fds.forEach((fd, i) => i !== index && GLib.close(fd))
        inhibitor = fds[index]
        setKeepAwake(true)
      } catch (error) {
        console.error(`Failed to inhibit idle: ${error}`)
      }
    },
  )
}

export function KeepAwakeTile({ onDetails }: { onDetails: () => void }) {
  return (
    <Tile
      icon={keepAwake.as((it) => (it ? "my-caffeine-on-symbolic" : "my-caffeine-off-symbolic"))}
      title="Keep awake"
      subtitle={keepAwake.as((it) => (it ? "On" : "Off"))}
      active={keepAwake}
      onToggle={toggleKeepAwake}
      onDetails={onDetails}
    />
  )
}

function TimingRow({ timing }: { timing: (typeof timings)[number] }) {
  const value = settings.as((it) => it[timing.key])
  const change = (direction: 1 | -1) => update({ [timing.key]: step(settings.get()[timing.key], direction) })

  return (
    <box cssClasses={["setting"]} spacing={4}>
      <label label={timing.label} hexpand xalign={0} />
      <button cssClasses={["icon-button"]} tooltipText="Sooner" sensitive={value.as((it) => it !== minute)} onClicked={() => change(-1)}>
        <image iconName="list-remove-symbolic" />
      </button>
      <label cssClasses={["value"]} label={value.as(describe)} widthChars={7} />
      <button cssClasses={["icon-button"]} tooltipText="Later" sensitive={value.as((it) => it !== idle.never)} onClicked={() => change(1)}>
        <image iconName="list-add-symbolic" />
      </button>
    </box>
  )
}

export function IdlePage({ onBack }: { onBack: () => void }) {
  return (
    <Panel title="Idle" onBack={onBack} footer={[{ label: "Reset to defaults", onClicked: () => update(defaults) }]}>
      <box orientation={Gtk.Orientation.VERTICAL}>
        {timings.map((timing) => (
          <TimingRow timing={timing} />
        ))}
        <box cssClasses={["setting"]}>
          <label label="Suspend on AC power" hexpand xalign={0} />
          <switch
            valign={Gtk.Align.CENTER}
            active={settings.as((it) => it.suspendOnAC)}
            onNotifyActive={({ active }) => active !== settings.get().suspendOnAC && update({ suspendOnAC: active })}
          />
        </box>
      </box>
    </Panel>
  )
}
