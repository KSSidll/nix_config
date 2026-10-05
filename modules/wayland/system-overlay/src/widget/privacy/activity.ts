import AstalWp from "gi://AstalWp"
import GLib from "gi://GLib"

// something using the screen, a camera or a microphone, as the privacy panel lists it
export type Activity = {
  id: string
  app: string
  target?: string
  action?: { label: string; run: () => void }
}

export const unknownApp = "Unknown app"

// a stream's own name is often the app's name for it, like "webrtc-consume-stream"
export const nodeApp = (node: AstalWp.Node) =>
  node.get_pw_property("application.name") ?? node.description ?? node.name ?? unknownApp

// nix wraps many programs, so their process is named like ".zen-wrapped"
export const commApp = (comm: string) => comm.replace(/^\./, "").replace(/-wrapped$/, "")

export function processApp(pid: number) {
  try {
    return commApp(new TextDecoder().decode(GLib.file_get_contents(`/proc/${pid}/comm`)[1]).trim())
  } catch {
    return unknownApp
  }
}
