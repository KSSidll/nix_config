import { createState } from "ags"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import Soup from "gi://Soup?version=3.0"
import { syncthing } from "../../config"
import { showInFiles } from "../files"
import { notify } from "../notifications/send"

Gio._promisify(Soup.Session.prototype, "send_and_read_async", "send_and_read_finish")

export type SyncDevice = { id: string; name: string }
export type SyncFolder = { id: string; label: string; items: number; bytes: number }
export type SyncStatus = { waiting: SyncDevice[]; catchingUp: SyncDevice[]; syncing: SyncFolder[] }

const [status, setStatus] = createState<SyncStatus>({ waiting: [], catchingUp: [], syncing: [] })
export { status }

// a folder shows once it has been busy this long, so the small syncs a working peer sends every few seconds don't
// flash the indicator, and hides once it has been idle as long, since a pull passes through idle between batches
const showAfterMs = 2000
const hideAfterMs = 2000
// a newly connected device is caught up once this long passes without index updates or transfers in its folders;
// until its index arrives, Syncthing reports the folders as up to date
const settleMs = 5000
// after a wake, Syncthing still counts the connections from before the suspend until they time out, so the devices
// connected then are waited for until a connection of theirs starts after the wake, or this long passes
const wakeWaitMs = 60000
const wakePollMs = 2000

const busyStates = new Set(["sync-waiting", "sync-preparing", "syncing"])

const conflictCopy = /^(.*)\.sync-conflict-\d{8}-\d{6}-[A-Z0-9]{7}(\.[^/]*)?$/

const eventTypes = [
  "StateChanged",
  "FolderSummary",
  "DeviceConnected",
  "DeviceDisconnected",
  "ClusterConfigReceived",
  "RemoteIndexUpdated",
  // a conflict copy arrives as a pulled file when another device made it, or when the local version won here
  "ItemFinished",
  // and is found by the scanner when the local version lost here and was renamed
  "LocalChangeDetected",
  "ConfigSaved",
].join(",")

type Folder = {
  id: string
  label: string
  path: string
  devices: string[]
  state: string
  items: number
  bytes: number
  shown: boolean
  timer: number | null
}
type Device = { id: string; name: string; connected: boolean; settling: boolean; timer: number | null }

type FolderConfig = { id: string; label: string; path: string; paused: boolean; devices: { deviceID: string }[] }
type DeviceConfig = { deviceID: string; name: string; paused: boolean }
type FolderStatus = { state: string; needTotalItems: number; needBytes: number }
type Connection = { connected: boolean; startedAt: string; secondary?: { startedAt: string }[] | null }
type Event = { id: number; type: string; data: Record<string, unknown> }

const folders = new Map<string, Folder>()
const devices = new Map<string, Device>()
const waitingFor = new Set<string>()
let wakeAt = 0
let wakeTimer: number | null = null
let onWake = () => {}

const session = new Soup.Session({ timeout: 90 })

function after(ms: number, run: () => void) {
  return GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
    run()
    return GLib.SOURCE_REMOVE
  })
}

function apiKey() {
  const [, contents] = GLib.file_get_contents(syncthing!.config)
  const key = /<apikey>([^<]+)<\/apikey>/.exec(new TextDecoder().decode(contents))?.[1]
  if (!key) throw new Error(`no API key in ${syncthing!.config}`)
  return key
}

async function get<T>(key: string, path: string): Promise<T> {
  const message = Soup.Message.new("GET", `${syncthing!.address}${path}`)
  message.get_request_headers().append("X-API-Key", key)
  const body = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null)
  if (message.get_status() !== Soup.Status.OK) throw new Error(`HTTP ${message.get_status()} for ${path}`)
  return JSON.parse(new TextDecoder().decode(body.toArray())) as T
}

function publish() {
  const named = (device: Device) => ({ id: device.id, name: device.name })
  setStatus({
    waiting: [...waitingFor].flatMap((id) => (devices.has(id) ? [named(devices.get(id)!)] : [])),
    catchingUp: [...devices.values()].filter((it) => it.settling && !waitingFor.has(it.id)).map(named),
    syncing: [...folders.values()]
      .filter((it) => it.shown)
      .map(({ id, label, items, bytes }) => ({ id, label, items, bytes })),
  })
}

const busy = (folder: Folder) => busyStates.has(folder.state)

function setFolderState(folder: Folder, state: string) {
  folder.state = state
  if (busy(folder) === folder.shown) {
    if (folder.timer !== null) GLib.source_remove(folder.timer)
    folder.timer = null
  } else if (folder.timer === null) {
    folder.timer = after(busy(folder) ? showAfterMs : hideAfterMs, () => {
      folder.timer = null
      folder.shown = busy(folder)
      publish()
    })
  }
  if (busy(folder)) for (const id of folder.devices) if (devices.get(id)?.settling) settle(devices.get(id)!)
}

function settle(device: Device) {
  device.settling = true
  if (device.timer !== null) GLib.source_remove(device.timer)
  device.timer = after(settleMs, () => {
    device.timer = null
    if ([...folders.values()].some((it) => it.devices.includes(device.id) && busy(it))) return settle(device)
    device.settling = false
    publish()
  })
}

function stopSettling(device: Device) {
  if (device.timer !== null) GLib.source_remove(device.timer)
  device.timer = null
  device.settling = false
}

function arrived(id: string) {
  const device = devices.get(id)
  if (!device) return
  device.connected = true
  waitingFor.delete(id)
  settle(device)
}

function expandHome(path: string) {
  return path === "~" || path.startsWith("~/") ? GLib.get_home_dir() + path.slice(1) : path
}

async function applyConfig(key: string) {
  const [folderConfigs, deviceConfigs, own] = await Promise.all([
    get<FolderConfig[]>(key, "/rest/config/folders"),
    get<DeviceConfig[]>(key, "/rest/config/devices"),
    get<{ myID: string }>(key, "/rest/system/status"),
  ])

  const peers = deviceConfigs.filter((it) => it.deviceID !== own.myID && !it.paused)
  for (const [id, device] of devices) if (!peers.some((it) => it.deviceID === id)) {
    stopSettling(device)
    waitingFor.delete(id)
    devices.delete(id)
  }
  for (const config of peers) {
    const device = devices.get(config.deviceID)
    const name = config.name || config.deviceID.slice(0, 7)
    if (device) device.name = name
    else devices.set(config.deviceID, { id: config.deviceID, name, connected: false, settling: false, timer: null })
  }

  const active = folderConfigs.filter((it) => !it.paused)
  for (const [id, folder] of folders) if (!active.some((it) => it.id === id)) {
    if (folder.timer !== null) GLib.source_remove(folder.timer)
    folders.delete(id)
  }
  const added: Folder[] = []
  for (const config of active) {
    const fields = {
      label: config.label || config.id,
      path: expandHome(config.path),
      devices: config.devices.map((it) => it.deviceID).filter((it) => it !== own.myID),
    }
    const folder = folders.get(config.id)
    if (folder) Object.assign(folder, fields)
    else {
      const created = { id: config.id, ...fields, state: "idle", items: 0, bytes: 0, shown: false, timer: null }
      folders.set(config.id, created)
      added.push(created)
    }
  }
  await Promise.all(
    added.map(async (folder) => {
      const summary = await get<FolderStatus>(key, `/rest/db/status?folder=${encodeURIComponent(folder.id)}`)
      folder.items = summary.needTotalItems
      folder.bytes = summary.needBytes
      setFolderState(folder, summary.state)
    }),
  )
}

function clear() {
  for (const folder of folders.values()) if (folder.timer !== null) GLib.source_remove(folder.timer)
  for (const device of devices.values()) stopSettling(device)
  if (wakeTimer !== null) GLib.source_remove(wakeTimer)
  wakeTimer = null
  folders.clear()
  devices.clear()
  waitingFor.clear()
}

// a lost connection to Syncthing loses its events too, so everything is read again
async function reload(key: string) {
  clear()
  await applyConfig(key)
  const { connections } = await get<{ connections: Record<string, Connection> }>(key, "/rest/system/connections")
  // at login the devices have only just connected, and their indexes may still be arriving
  for (const [id, connection] of Object.entries(connections)) if (connection.connected) arrived(id)
  publish()
}

async function pollWake(key: string, wake: number) {
  while (wakeAt === wake && waitingFor.size > 0 && wakeTimer !== null) {
    try {
      const { connections } = await get<{ connections: Record<string, Connection> }>(key, "/rest/system/connections")
      for (const id of [...waitingFor]) {
        const connection = connections[id]
        if (!connection?.connected) continue
        const starts = [connection.startedAt, ...(connection.secondary ?? []).map((it) => it.startedAt)]
        // startedAt has whole seconds
        if (starts.some((it) => Date.parse(it) >= wakeAt - 1000)) arrived(id)
      }
      publish()
    } catch (error) {
      console.error(`Failed to read Syncthing's connections after a wake: ${error}`)
    }
    await new Promise((resolve) => after(wakePollMs, () => resolve(null)))
  }
}

function woke(key: string) {
  wakeAt = Date.now()
  waitingFor.clear()
  for (const device of devices.values()) if (device.connected) waitingFor.add(device.id)
  if (wakeTimer !== null) GLib.source_remove(wakeTimer)
  wakeTimer = null
  if (waitingFor.size === 0) return
  wakeTimer = after(wakeWaitMs, () => {
    wakeTimer = null
    waitingFor.clear()
    publish()
  })
  publish()
  pollWake(key, wakeAt)
}

const reported = new Set<string>()

function conflict(folderId: string, item: string) {
  const match = conflictCopy.exec(item)
  const key = `${folderId}/${item}`
  if (!match || reported.has(key)) return
  reported.add(key)
  const folder = folders.get(folderId)
  const file = folder ? GLib.build_filenamev([folder.path, item]) : null
  notify({
    app: "Syncthing",
    icon: "dialog-warning-symbolic",
    summary: `Sync conflict in ${folder?.label ?? folderId}`,
    body: `${match[1]}${match[2] ?? ""} changed on two devices. The newer change is kept, and the other is saved next to it as ${GLib.path_get_basename(item)}.`,
    actions: file ? [{ id: "show", label: "Show in Files", run: () => showInFiles(file) }] : [],
  }).catch((error: unknown) => console.error(`Failed to report a sync conflict [${folderId}, item: ${item}]: ${error}`))
}

function handle(key: string, { type, data }: Event) {
  const text = (field: string) => (typeof data[field] === "string" ? (data[field] as string) : "")
  switch (type) {
    case "StateChanged": {
      const folder = folders.get(text("folder"))
      if (folder) setFolderState(folder, text("to"))
      break
    }
    case "FolderSummary": {
      const folder = folders.get(text("folder"))
      const summary = data.summary as FolderStatus | undefined
      if (folder && summary) {
        folder.items = summary.needTotalItems
        folder.bytes = summary.needBytes
      }
      break
    }
    case "DeviceConnected":
      arrived(text("id"))
      break
    case "DeviceDisconnected": {
      const device = devices.get(text("id"))
      if (device) {
        device.connected = false
        stopSettling(device)
      }
      break
    }
    case "ClusterConfigReceived":
      arrived(text("device"))
      break
    case "RemoteIndexUpdated": {
      const device = devices.get(text("device"))
      if (device?.settling) settle(device)
      break
    }
    case "ItemFinished":
      if (data.error == null && text("action") !== "delete") conflict(text("folder"), text("item"))
      break
    case "LocalChangeDetected":
      if (text("action") !== "deleted") conflict(text("folderID") || text("folder"), text("path"))
      break
    case "ConfigSaved":
      applyConfig(key)
        .then(publish)
        .catch((error: unknown) => console.error(`Failed to read Syncthing's changed config: ${error}`))
      break
  }
  publish()
}

async function follow() {
  let failure = ""
  for (;;) {
    try {
      const key = apiKey()
      // the first request subscribes, so whatever happens while the state loads is in the next one
      let since = Math.max(0, ...(await get<Event[]>(key, `/rest/events?events=${eventTypes}&timeout=0`)).map((it) => it.id))
      await reload(key)
      onWake = () => woke(key)
      failure = ""
      for (;;) {
        const events = await get<Event[]>(key, `/rest/events?events=${eventTypes}&since=${since}&timeout=60`)
        for (const event of events) {
          since = event.id
          handle(key, event)
        }
      }
    } catch (error) {
      onWake = () => {}
      if (String(error) !== failure) console.error(`Lost Syncthing's events, retrying every 5 s: ${error}`)
      failure = String(error)
      clear()
      publish()
      await new Promise((resolve) => after(5000, () => resolve(null)))
    }
  }
}

export function startSyncthing() {
  Gio.DBus.system.signal_subscribe(
    "org.freedesktop.login1",
    "org.freedesktop.login1.Manager",
    "PrepareForSleep",
    "/org/freedesktop/login1",
    null,
    Gio.DBusSignalFlags.NONE,
    (_connection, _sender, _path, _iface, _member, parameters) => {
      const [sleeping] = parameters!.deepUnpack() as [boolean]
      if (!sleeping) onWake()
    },
  )
  follow()
}
