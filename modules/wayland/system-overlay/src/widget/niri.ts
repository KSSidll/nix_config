import { createState } from "ags"
import Gio from "gi://Gio"
import GLib from "gi://GLib"

Gio._promisify(Gio.DataInputStream.prototype, "read_line_async", "read_line_finish_utf8")
Gio._promisify(Gio.DBusConnection.prototype, "call", "call_finish")

export type Workspace = {
  id: number
  idx: number
  name: string | null
  output: string | null
  is_urgent: boolean
  is_active: boolean
  is_focused: boolean
  active_window_id: number | null
}

export type Cast = {
  stream_id: number
  session_id: number
  kind: "PipeWire" | "WlrScreencopy"
  target: { Nothing: {} } | { Output: { name: string } } | { Window: { id: number } }
  is_active: boolean
  pid: number | null
  pw_node_id: number | null
}

export type Window = { id: number; title: string | null; app_id: string | null; pid: number | null; is_focused: boolean }

export type Mode = { width: number; height: number; refresh_rate: number; is_preferred: boolean }

// an output that is off has no current mode and no logical size
export type Output = {
  name: string
  make: string
  model: string
  serial: string | null
  modes: Mode[]
  current_mode: number | null
  logical: { x: number; y: number; width: number; height: number; scale: number } | null
}

type Event =
  | { WorkspacesChanged: { workspaces: Workspace[] } }
  | { WorkspaceActivated: { id: number; focused: boolean } }
  | { WorkspaceUrgencyChanged: { id: number; urgent: boolean } }
  | { WorkspaceActiveWindowChanged: { workspace_id: number; active_window_id: number | null } }
  | { CastsChanged: { casts: Cast[] } }
  | { CastStartedOrChanged: { cast: Cast } }
  | { CastStopped: { stream_id: number } }
  | { ScreenshotCaptured: { path: string | null } }

const [workspaces, setWorkspaces] = createState<Workspace[]>([])
export { workspaces }

const [casts, setCasts] = createState<Cast[]>([])
export { casts }

// the output holding the focused workspace, which is where keyboard focus is
export const focusedOutput = workspaces.as((all) => all.find((it) => it.is_focused)?.output ?? null)

// every request takes its own connection: after the event stream request, a connection only carries events
function request(body: unknown) {
  const socket = GLib.getenv("NIRI_SOCKET")
  if (!socket) throw new Error("NIRI_SOCKET is not set")
  const connection = new Gio.SocketClient().connect(Gio.UnixSocketAddress.new(socket), null)
  connection.get_output_stream().write_all(new TextEncoder().encode(`${JSON.stringify(body)}\n`), null)
  const input = new Gio.DataInputStream({ base_stream: connection.get_input_stream(), close_base_stream: true })
  const readLine = () => input.read_line_async(GLib.PRIORITY_DEFAULT, null) as unknown as Promise<[string | null, number]>
  return { connection, readLine }
}

function send(body: Record<string, unknown>) {
  const { connection, readLine } = request(body)
  readLine()
    .then(([reply]) => {
      if (reply && !reply.startsWith('{"Ok"')) console.error(`niri refused a request [${JSON.stringify(body)}]: ${reply}`)
    })
    .catch((error) => console.error(`niri request failed [${JSON.stringify(body)}]: ${error}`))
    .finally(() => connection.close(null))
}

export const action = (body: Record<string, unknown>) => send({ Action: body })

// changes an output until niri restarts, like `niri msg output`
export const configureOutput = (output: string, change: unknown) => send({ Output: { output, action: change } })

// a request by its name, such as "Windows", answered under the same name unless niri names the answer differently
export async function query<T>(name: string, answer = name): Promise<T> {
  const { connection, readLine } = request(name)
  try {
    const [reply] = await readLine()
    const parsed = reply === null ? null : JSON.parse(reply)
    if (!parsed || !("Ok" in parsed)) throw new Error(`niri refused a query [${name}]: ${reply}`)
    return parsed.Ok[answer]
  } finally {
    connection.close(null)
  }
}

// An app asking to be raised from a D-Bus call (MPRIS, a tray click) has no activation token, which niri can refuse;
// its window is found through the process that owns its bus name instead.
export async function windowOfBusName(busName: string) {
  const reply = await Gio.DBus.session.call(
    "org.freedesktop.DBus",
    "/org/freedesktop/DBus",
    "org.freedesktop.DBus",
    "GetConnectionUnixProcessID",
    new GLib.Variant("(s)", [busName]),
    null,
    Gio.DBusCallFlags.NONE,
    -1,
    null,
  )
  const [pid] = reply.deepUnpack() as [number]
  return (await query<Window[]>("Windows")).find((it) => it.pid === pid) ?? null
}

// null when the screenshot was only copied to the clipboard
const screenshotListeners: ((path: string | null) => void)[] = []
export const onScreenshot = (listener: (path: string | null) => void) => screenshotListeners.push(listener)

function apply(event: Event) {
  const all = workspaces.get()
  if ("WorkspacesChanged" in event) {
    setWorkspaces(event.WorkspacesChanged.workspaces)
  } else if ("WorkspaceActivated" in event) {
    const { id, focused } = event.WorkspaceActivated
    const output = all.find((it) => it.id === id)?.output
    setWorkspaces(all.map((it) => ({
      ...it,
      is_active: it.output === output ? it.id === id : it.is_active,
      is_focused: focused ? it.id === id : it.is_focused,
    })))
  } else if ("WorkspaceUrgencyChanged" in event) {
    const { id, urgent } = event.WorkspaceUrgencyChanged
    setWorkspaces(all.map((it) => (it.id === id ? { ...it, is_urgent: urgent } : it)))
  } else if ("WorkspaceActiveWindowChanged" in event) {
    const { workspace_id, active_window_id } = event.WorkspaceActiveWindowChanged
    setWorkspaces(all.map((it) => (it.id === workspace_id ? { ...it, active_window_id } : it)))
  } else if ("CastsChanged" in event) {
    setCasts(event.CastsChanged.casts)
  } else if ("CastStartedOrChanged" in event) {
    const { cast } = event.CastStartedOrChanged
    setCasts([...casts.get().filter((it) => it.stream_id !== cast.stream_id), cast])
  } else if ("CastStopped" in event) {
    setCasts(casts.get().filter((it) => it.stream_id !== event.CastStopped.stream_id))
  } else if ("ScreenshotCaptured" in event) {
    for (const listener of screenshotListeners) listener(event.ScreenshotCaptured.path)
  }
}

async function listen() {
  const { connection, readLine } = request("EventStream")
  for (;;) {
    const [line] = await readLine()
    if (line === null) break
    const event = JSON.parse(line)
    if (!("Ok" in event)) apply(event)
  }
  connection.close(null)
  console.error("niri event stream closed")
}

listen().catch((error) => console.error(`niri event stream failed: ${error}`))
