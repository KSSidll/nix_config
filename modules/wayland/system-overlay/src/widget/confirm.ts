import { createState } from "ags"
import GLib from "gi://GLib"

const confirmWindowMs = 3000

// actions that ask for a second click within a few seconds before they run; armed is the key waiting for it
export function createConfirm<T>() {
  const [armed, setArmed] = createState<T | null>(null)
  let disarm: number | null = null

  const press = (key: T, action: () => void) => {
    if (disarm !== null) GLib.source_remove(disarm)
    disarm = null
    if (armed.get() === key) {
      setArmed(null)
      return action()
    }
    setArmed(key)
    disarm = GLib.timeout_add(GLib.PRIORITY_DEFAULT, confirmWindowMs, () => {
      disarm = null
      setArmed(null)
      return GLib.SOURCE_REMOVE
    })
  }

  return { armed, press }
}
