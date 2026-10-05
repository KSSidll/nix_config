import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { type Action, notify } from "./notifications/send"
import { launch } from "./panels"
import { commApp } from "./privacy/activity"

Gio._promisify(Gio.DataInputStream.prototype, "read_line_async", "read_line_finish_utf8")
Gio._promisify(Gio.Subprocess.prototype, "wait_async", "wait_finish")

type Entry = Record<string, string>

type Notice = { key: string; summary: string; body: string; icon: string; actions: Action[] }

const uid = String(new Gio.Credentials().get_unix_user())
const userManager = `user@${uid}.service`
// as the journal writes it, without dashes
const bootId = new TextDecoder()
  .decode(GLib.file_get_contents("/proc/sys/kernel/random/boot_id")[1])
  .trim()
  .replaceAll("-", "")

const cursorFile = GLib.build_filenamev([GLib.get_user_state_dir(), "system-overlay", "journal-cursor"])

function inTerminal(...command: string[]) {
  const terminal = GLib.getenv("TERMINAL")
  if (!terminal) {
    console.error(`No TERMINAL to run a command in [${command.join(" ")}]`)
    return
  }
  launch(terminal, "-e", ...command)
}

const results: Record<string, string> = {
  "exit-code": "exited with an error",
  signal: "was killed by a signal",
  timeout: "timed out",
  watchdog: "stopped responding",
  "oom-kill": "was killed for running out of memory",
  "start-limit-hit": "failed too often in a row and is no longer restarted",
  resources: "couldn't get what it needs to start",
  protocol: "didn't report that it started",
}

function unitFailed(entry: Entry): Notice | null {
  // a crashed service gets the crash notification instead
  if (entry.UNIT_RESULT === "core-dump") return null
  // other users' managers, like the display manager's, run units of other sessions
  const system = entry._PID === "1" ? entry.UNIT : undefined
  const user = entry._SYSTEMD_UNIT === userManager ? entry.USER_UNIT : undefined
  const unit = system ?? user
  if (!unit) return null
  const result = entry.UNIT_RESULT ?? "unknown"
  return {
    key: `unit ${system ? "system" : "user"} ${unit}`,
    summary: `${unit} failed`,
    body: `The ${system ? "system" : "user"} unit ${results[result] ?? "failed"} (${result}).`,
    icon: "dialog-warning-symbolic",
    actions: [
      {
        id: "log",
        label: "Show log",
        run: () => inTerminal("journalctl", "--boot", "--pager-end", system ? "--unit" : "--user-unit", unit),
      },
    ],
  }
}

function crashed(entry: Entry): Notice | null {
  const own = entry.COREDUMP_UID === uid
  if (!own && entry.COREDUMP_UID !== "0") return null
  const exe = entry.COREDUMP_EXE ?? entry.COREDUMP_COMM ?? "unknown"
  const pid = entry.COREDUMP_PID
  const signal = entry.COREDUMP_SIGNAL_NAME ?? `Signal ${entry.COREDUMP_SIGNAL}`
  const unit = [entry.COREDUMP_USER_UNIT, entry.COREDUMP_UNIT].find((it) => it?.endsWith(".service") && it !== userManager)
  return {
    key: `crash ${exe}`,
    summary: `${commApp(GLib.path_get_basename(exe))} crashed`,
    body: `${signal} in process ${pid}${unit ? ` of ${unit}` : ""}.`,
    icon: "dialog-error-symbolic",
    actions: [
      { id: "info", label: "Details", run: () => inTerminal("coredumpctl", "info", pid) },
      // the core file of a root process is readable by root only
      ...(own ? [{ id: "debug", label: "Debug", run: () => inTerminal("coredumpctl", "debug", pid) }] : []),
    ],
  }
}

// by the catalog ids systemd gives these messages, which stay when their wording changes
const unitFailedId = "d9b373ed55a64feb8242e02dbe79a49c"
const crashId = "fc2e22bc6ee647b6b90729ab34a250b1"
// logind's "System is powering down" and "System is rebooting"
const shutdownId = "98268866d1d54a499c4e98921d93bc40"

const kinds: Record<string, (entry: Entry) => Notice | null> = {
  [unitFailedId]: unitFailed,
  [crashId]: crashed,
}

// boots whose shutdown has begun: what fails after it is services being stopped
const shuttingDown = new Set<string>()

function noticeOf(entry: Entry) {
  if (entry.MESSAGE_ID === shutdownId) {
    if (entry._UID === "0") shuttingDown.add(entry._BOOT_ID)
    return null
  }
  if (shuttingDown.has(entry._BOOT_ID)) return null
  return kinds[entry.MESSAGE_ID]?.(entry) ?? null
}

// the failures of a boot before this one in a single notification, led by the first: a crashed session takes its
// services down with it
function beforeRestart(boot: string, failures: { notice: Notice; entry: Entry }[]): Notice {
  const [first, ...rest] = [...new Map(failures.map((it) => [it.notice.key, it])).values()]
  const seconds = Math.floor(Number(first.entry.__REALTIME_TIMESTAMP) / 1e6)
  const time = GLib.DateTime.new_from_unix_local(seconds)
  const today = time.format("%F") === GLib.DateTime.new_now_local().format("%F")
  const at = today ? `At ${time.format("%H:%M")}` : `On ${time.format("%-d %B")} at ${time.format("%H:%M")}`
  const listed = rest.slice(0, 4).map((it) => it.notice.summary)
  const others = rest.length - listed.length
  return {
    key: `boot ${boot}`,
    summary: `${first.notice.summary} before the restart`,
    body: rest.length ? `${at}, then ${listed.join(", ")}${others ? ` and ${others} others` : ""}.` : `${at}.`,
    icon: first.notice.icon,
    actions: [
      // from shortly before the first failure, where its cause is
      { id: "log", label: "Show log", run: () => inTerminal("journalctl", `--boot=${boot}`, `--since=@${seconds - 30}`) },
      ...(failures.some((it) => it.entry.MESSAGE_ID === crashId)
        ? [{ id: "crashes", label: "Crashes", run: () => inTerminal("coredumpctl", "list", `_BOOT_ID=${boot}`) }]
        : []),
    ],
  }
}

// a repeated failure replaces its earlier notification
const shown = new Map<string, number>()

function show(notice: Notice) {
  const { key, ...content } = notice
  notify({ app: "System", ...content, replaces: shown.get(key) ?? 0 })
    .then((id) => shown.set(key, id))
    .catch((error) => console.error(`Failed to show a failure [key: ${key}]: ${error}`))
}

function readCursor() {
  try {
    return new TextDecoder().decode(GLib.file_get_contents(cursorFile)[1]).trim() || null
  } catch {
    return null
  }
}

function saveCursor(cursor: string) {
  try {
    GLib.mkdir_with_parents(GLib.path_get_dirname(cursorFile), 0o755)
    GLib.file_set_contents(cursorFile, cursor)
  } catch (error) {
    console.error(`Failed to save the journal cursor [file: ${cursorFile}]: ${error}`)
  }
}

function parse(line: string): Entry | null {
  let fields: Record<string, unknown>
  try {
    fields = JSON.parse(line)
  } catch (error) {
    console.error(`Unreadable journal entry [${line.slice(0, 200)}]: ${error}`)
    return null
  }
  // journalctl gives a field that isn't valid UTF-8 as an array of bytes
  return Object.fromEntries(Object.entries(fields).filter((it): it is [string, string] => typeof it[1] === "string"))
}

let cursor = readCursor()

function journal(follow: boolean) {
  const argv = [
    "journalctl",
    "--output=json",
    // from where the last run stopped, so each failure shows once, those from before a restart included
    ...(cursor ? [`--after-cursor=${cursor}`] : ["--boot"]),
    ...(follow ? ["--follow", "--no-tail"] : []),
    ...[...Object.keys(kinds), shutdownId].map((id) => `MESSAGE_ID=${id}`),
  ]
  return Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_PIPE)
}

// hands over each entry until journalctl exits, then gives its exit status
async function read(process: Gio.Subprocess, each: (entry: Entry) => void) {
  const input = new Gio.DataInputStream({ base_stream: process.get_stdout_pipe()!, close_base_stream: true })
  for (;;) {
    const [line] = await (input.read_line_async(GLib.PRIORITY_DEFAULT, null) as unknown as Promise<[string | null, number]>)
    if (line === null) break
    const entry = parse(line)
    if (!entry) continue
    if (entry.__CURSOR) {
      cursor = entry.__CURSOR
      saveCursor(cursor)
    }
    each(entry)
  }
  await process.wait_async(null)
  return process.get_if_exited() ? process.get_exit_status() : -1
}

async function start() {
  const from = cursor
  // what is already in the journal first, so the failures of an earlier boot can be told together
  const earlier = new Map<string, { notice: Notice; entry: Entry }[]>()
  const current: Notice[] = []
  let status = await read(journal(false), (entry) => {
    const notice = noticeOf(entry)
    if (!notice) return
    if (entry._BOOT_ID === bootId) current.push(notice)
    else earlier.set(entry._BOOT_ID, [...(earlier.get(entry._BOOT_ID) ?? []), { notice, entry }])
  })
  earlier.forEach((failures, boot) => show(beforeRestart(boot, failures)))
  current.forEach(show)

  if (status === 0)
    status = await read(journal(true), (entry) => {
      const notice = noticeOf(entry)
      if (notice) show(notice)
    })
  console.error(`journalctl stopped reading failures [status: ${status}, cursor: ${cursor}]`)
  // a cursor the journal no longer resolves fails before the first entry, and would fail every restart
  if (status !== 0 && from && cursor === from) {
    GLib.unlink(cursorFile)
    cursor = null
  }
  GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
    start().catch((error) => console.error(`Failed to read failures from the journal: ${error}`))
    return GLib.SOURCE_REMOVE
  })
}

export function startFailureNotifications() {
  // the notification server is this overlay, which takes the name only after startup
  let started = false
  Gio.bus_watch_name(
    Gio.BusType.SESSION,
    "org.freedesktop.Notifications",
    Gio.BusNameWatcherFlags.NONE,
    () => {
      if (started) return
      started = true
      start().catch((error) => console.error(`Failed to read failures from the journal: ${error}`))
    },
    null,
  )
}
