import { createState } from "ags"
import GLib from "gi://GLib"
import { open } from "../panels"

export type OsdKind = "volume" | "brightness" | "microphone" | "media"

const visibleMs = 1500

const [shown, setShown] = createState<OsdKind | null>(null)
export { shown }

let hideSource: number | null = null

export function showOsd(kind: OsdKind) {
  // quick settings already shows these levels on its own sliders
  if (open.get()?.anchor.has_css_class("quick-settings-button")) return
  setShown(kind)
  if (hideSource !== null) GLib.source_remove(hideSource)
  hideSource = GLib.timeout_add(GLib.PRIORITY_DEFAULT, visibleMs, () => {
    hideSource = null
    setShown(null)
    return GLib.SOURCE_REMOVE
  })
}
