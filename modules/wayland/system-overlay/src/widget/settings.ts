import { createState } from "ags"
import GLib from "gi://GLib"
import { settings as config } from "../config"

type Settings = typeof config.defaults

const { defaults, overrides: path } = config

// only overrides of settings that still exist, with the type of their default
function readOverrides(): Partial<Settings> {
  let stored: Record<string, unknown>
  try {
    stored = JSON.parse(new TextDecoder().decode(GLib.file_get_contents(path)[1]))
  } catch {
    return {}
  }
  return Object.fromEntries(
    Object.entries(stored).filter(([key, value]) => key in defaults && typeof value === typeof defaults[key as keyof Settings]),
  )
}

// a table setting takes the overrides' entries over the nix ones, so entries added in nix later still show
function withOverrides(): Settings {
  const merged: Record<string, unknown> = { ...defaults }
  for (const [key, value] of Object.entries(readOverrides())) {
    const base = defaults[key as keyof Settings]
    merged[key] = typeof base === "object" && base !== null ? { ...base, ...(value as object) } : value
  }
  return merged as Settings
}

const [settings, setSettings] = createState<Settings>(withOverrides())
export { settings }

// stores only what differs from the nix defaults, and no file once nothing does
export function changeSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  const next = { ...settings.get(), [key]: value }
  setSettings(next)
  const changed = Object.fromEntries(
    Object.entries(next).filter(([name, it]) => JSON.stringify(it) !== JSON.stringify(defaults[name as keyof Settings])),
  )
  try {
    if (Object.keys(changed).length > 0) {
      GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o755)
      GLib.file_set_contents(path, JSON.stringify(changed, null, 2) + "\n")
    } else if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
      GLib.unlink(path)
    }
  } catch (error) {
    console.error(`Failed to write the overlay's overrides [${path}]: ${error}`)
  }
}
