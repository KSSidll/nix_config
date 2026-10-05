import app from "ags/gtk4/app"
import { createComputed, createRoot, createState, onCleanup, With } from "ags"
import { execAsync } from "ags/process"
import Gdk from "gi://Gdk?version=4.0"
import Gtk from "gi://Gtk?version=4.0"
import Astal from "gi://Astal?version=4.0"
import { geometry } from "../config"
import { action } from "./niri"

export type PanelContent = () => JSX.Element

// a panel drawn by the panel host, or a tray app's GTK menu, which stays a popover on the bar;
// a modal panel demands attention: it is centered under the bar and the host dims the screen around it
type Open = { anchor: Gtk.Widget; monitor: Gdk.Monitor } & (
  | { content: PanelContent; modal: boolean }
  | { menu: Gtk.MenuButton }
)

const [open, setOpen] = createState<Open | null>(null)
export { open }

// The horizontal span the open item covers on its monitor, for surfaces that must not cover it. Until the item has
// been placed it counts as covering its whole monitor.
const [placed, setPlaced] = createState<{ item: Open; start: number; end: number } | null>(null)
export const openSpan = createComputed(() => {
  const current = open()
  if (!current) return null
  const known = placed()
  return known?.item === current
    ? { monitor: current.monitor, start: known.start, end: known.end }
    : { monitor: current.monitor, start: 0, end: current.monitor.geometry.width }
})

function centerUnder(anchor: Gtk.Widget, width: number) {
  const [, bounds] = anchor.compute_bounds(anchor.get_root()!)
  return bounds.get_x() + bounds.get_width() / 2 - width / 2
}

const monitorOf = (widget: Gtk.Widget) => (widget.get_root() as Astal.Window).gdkmonitor

// switches straight to the next item, so the panel host stays up and keeps the keyboard instead of being recreated
function show(next: Open | null) {
  const previous = open.get()
  setOpen(next)
  if (previous && "menu" in previous && previous.anchor !== next?.anchor) previous.menu.popdown()
}

export function closePanel() {
  show(null)
}

export function openPanel(anchor: Gtk.Widget, content: PanelContent, { modal = false } = {}) {
  show({ anchor, monitor: monitorOf(anchor), content, modal })
}

export function togglePanel(anchor: Gtk.Widget, content: PanelContent) {
  if (open.get()?.anchor === anchor) closePanel()
  else openPanel(anchor, content)
}

// while anything is open, hovering another bar button switches to it, like a menu bar
export function switchOnHover(anchor: Gtk.Widget, activate: () => void) {
  const motion = new Gtk.EventControllerMotion()
  motion.connect("enter", () => {
    const current = open.get()
    if (current && current.anchor !== anchor) activate()
  })
  anchor.add_controller(motion)
}

export function trackMenu(button: Gtk.MenuButton) {
  const watch = (popover: Gtk.Popover) => {
    // a grabbing popover hides all pointer motion from the bar, which hover switching needs; the panel host closes it instead
    popover.autohide = false
    popover.connect("show", () => {
      if (open.get()?.anchor !== button) show({ anchor: button, monitor: monitorOf(button), menu: button })
      const [, width] = popover.measure(Gtk.Orientation.HORIZONTAL, -1)
      const start = centerUnder(button, width)
      setPlaced({ item: open.get()!, start, end: start + width })
    })
    popover.connect("hide", () => {
      if (open.get()?.anchor === button) setOpen(null)
    })
  }
  if (button.popover) watch(button.popover)
  button.connect("notify::popover", () => button.popover && watch(button.popover))
  switchOnHover(button, () => button.popup())
}

export function launch(...command: string[]) {
  closePanel()
  action({ Spawn: { command } })
}

export function run(command: string[]) {
  closePanel()
  execAsync(command).catch((error) => console.error(`Failed to run [${command.join(" ")}]: ${error}`))
}

function place(frame: Gtk.Widget, item: Open & { content: PanelContent; modal: boolean }) {
  const [, width] = frame.measure(Gtk.Orientation.HORIZONTAL, -1)
  const monitorWidth = item.monitor.geometry.width
  let start = (monitorWidth - width) / 2
  if (!item.modal) {
    const max = monitorWidth - width - geometry.gap
    start = Math.round(Math.max(geometry.gap, Math.min(centerUnder(item.anchor, width), max)))
    frame.marginStart = start
  }
  setPlaced({ item, start, end: start + width })
}

function PanelHostWindow({ monitor }: { monitor: Gdk.Monitor }) {
  const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor
  let frame: Gtk.Widget | null = null

  const onPressed = (gesture: Gtk.GestureClick, _: number, x: number, y: number) => {
    const target = gesture.widget?.pick(x, y, Gtk.PickFlags.DEFAULT)
    if (frame && target && (target === frame || target.is_ancestor(frame))) return
    closePanel()
  }

  return (
    <window
      visible
      namespace="system-overlay-panels"
      cssClasses={open.as((it) => (it && "content" in it && it.modal ? ["PanelHost", "modal"] : ["PanelHost"]))}
      gdkmonitor={monitor}
      anchor={TOP | BOTTOM | LEFT | RIGHT}
      exclusivity={Astal.Exclusivity.NORMAL}
      keymode={Astal.Keymode.ON_DEMAND}
      application={app}
    >
      <Gtk.GestureClick button={0} onPressed={onPressed} />
      <Gtk.EventControllerKey
        onKeyPressed={(_, keyval) => {
          if (keyval !== Gdk.KEY_Escape) return false
          closePanel()
          return true
        }}
      />
      <box>
        <With value={open}>
          {(current) => {
            if (!current || current.monitor !== monitor || !("content" in current)) return <box />
            return (
              <box
                cssClasses={["panel-frame"]}
                halign={current.modal ? Gtk.Align.CENTER : Gtk.Align.START}
                valign={Gtk.Align.START}
                $={(self) => {
                  frame = self
                  self.connect("realize", () => place(self, current))
                }}
              >
                {current.content()}
              </box>
            )
          }}
        </With>
      </box>
    </window>
  ) as Astal.Window
}

// Covers the monitor below the bar while anything is open: it draws the open panel, closes on clicks outside it and on Escape.
// Every open creates a fresh window and every close destroys it: mapping is what hands it the keyboard, and unmapping is
// what gives the keyboard back to the window underneath; a reused or merely hidden layer surface can be left believing
// it has focus without getting key events.
export function attachPanelHost(monitor: Gdk.Monitor) {
  let host: { window: Astal.Window; dispose: () => void } | null = null
  const needed = open.as((it) => it?.monitor === monitor)

  const teardown = () => {
    host?.dispose()
    host?.window.destroy()
    host = null
  }
  const sync = () => {
    if (needed.get() === (host !== null)) return
    if (host) teardown()
    else host = createRoot((dispose) => ({ window: PanelHostWindow({ monitor }), dispose }))
  }

  const unsubscribe = needed.subscribe(sync)
  onCleanup(() => {
    unsubscribe()
    teardown()
  })
}
