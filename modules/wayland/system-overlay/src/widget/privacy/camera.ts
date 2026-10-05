import { createState } from "ags"
import GLib from "gi://GLib"
import { Activity, processApp } from "./activity"

const pollSeconds = 2

// Most apps open /dev/video* directly, out of PipeWire's sight. A streaming USB camera leaves runtime suspend, so its
// power state is a cheap check; a camera without runtime power management is checked by the process scan every time.
function powerStates() {
  const states: (string | null)[] = []
  const dir = GLib.Dir.open("/sys/class/video4linux", 0)
  for (let name = dir.read_name(); name !== null; name = dir.read_name()) {
    if (name.startsWith("video")) states.push(powerState(`/sys/class/video4linux/${name}`))
  }
  dir.close()
  return [...new Set(states)]
}

// the nearest device above the video node that does runtime power management, e.g. a camera's USB device
function powerState(node: string) {
  let path = GLib.canonicalize_filename(GLib.file_read_link(node), "/sys/class/video4linux")
  for (; path !== "/sys/devices"; path = GLib.path_get_dirname(path)) {
    try {
      if (read(`${path}/power/runtime_status`) !== "unsupported") return `${path}/power/runtime_status`
    } catch {
      // no power management at this level
    }
  }
  return null
}

const read = (path: string) => new TextDecoder().decode(GLib.file_get_contents(path)[1]).trim()

// uvcvideo names a camera "product: product", cut at the kernel's 32 characters
function deviceName(device: string) {
  try {
    return read(`/sys/class/video4linux/${GLib.path_get_basename(device)}/name`).split(": ")[0]
  } catch {
    return device
  }
}

// processes holding a camera open; only the user's own are readable, which covers the apps they run
function cameraHolders() {
  const holders: Activity[] = []
  const proc = GLib.Dir.open("/proc", 0)
  for (let pid = proc.read_name(); pid !== null; pid = proc.read_name()) {
    if (!/^\d+$/.test(pid)) continue
    try {
      const fds = GLib.Dir.open(`/proc/${pid}/fd`, 0)
      for (let fd = fds.read_name(); fd !== null; fd = fds.read_name()) {
        let target: string
        try {
          target = GLib.file_read_link(`/proc/${pid}/fd/${fd}`)
        } catch {
          continue
        }
        if (target.startsWith("/dev/video")) {
          // an app's processes can each hold the camera; it's one use of the device
          const holder = { app: processApp(Number(pid)), target: deviceName(target) }
          const id = `camera-${holder.app}-${target}`
          if (!holders.some((it) => it.id === id)) holders.push({ id, ...holder })
          break
        }
      }
      fds.close()
    } catch {
      // gone, or another user's
    }
  }
  proc.close()
  return holders
}

const [cameraUsers, setCameraUsers] = createState<Activity[]>([])
export { cameraUsers }

let states: (string | null)[] = []
try {
  states = powerStates()
} catch {
  // no video4linux devices
}

function poll() {
  // a camera only briefly opened, like a browser listing devices, stays awake a moment after it's closed; the scan
  // finds no holder then, so it doesn't show
  const awake = states.some((path) => {
    if (path === null) return true
    try {
      return read(path) === "active"
    } catch {
      return false
    }
  })
  const users = awake ? cameraHolders() : []
  const ids = (all: Activity[]) => all.map((it) => it.id).join(" ")
  if (ids(users) !== ids(cameraUsers.get())) setCameraUsers(users)
  return GLib.SOURCE_CONTINUE
}

if (states.length > 0) GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, pollSeconds, poll)
