import GLib from "gi://GLib"
import Gdk from "gi://Gdk?version=4.0"
import Gtk from "gi://Gtk?version=4.0"

// a pause this long between scroll events starts a new gesture, for sources that never signal one ending
const gestureGapUs = 300_000

// Mouse wheels report whole notches; touchpads report pixels, as a stream of small deltas per gesture.
// Both are converted into steps: a notch is worth `perNotch` steps, a touchpad step takes `pixelsPerStep` pixels.
// `oncePerGesture` lets one touchpad swipe produce a single step however long it is.
export type ScrollSteps = {
  perNotch: number
  pixelsPerStep: number
  oncePerGesture?: boolean
  onSteps: (steps: number) => void
}

export function scrollSteps({ perNotch, pixelsPerStep, oncePerGesture = false, onSteps }: ScrollSteps) {
  const controller = new Gtk.EventControllerScroll({ flags: Gtk.EventControllerScrollFlags.VERTICAL })
  let pending = 0
  let stepped = false
  let last = 0

  const newGesture = () => {
    pending = 0
    stepped = false
  }

  controller.connect("scroll-begin", newGesture)
  controller.connect("scroll", (self, _, dy) => {
    const now = GLib.get_monotonic_time()
    if (now - last > gestureGapUs) newGesture()
    last = now

    const wheel = self.get_unit() === Gdk.ScrollUnit.WHEEL
    if (oncePerGesture && stepped && !wheel) return true

    pending += wheel ? dy * perNotch : dy / pixelsPerStep
    const steps = Math.trunc(pending)
    if (steps !== 0) {
      pending -= steps
      stepped = true
      onSteps(oncePerGesture ? Math.sign(steps) : steps)
    }
    return true
  })
  return controller
}
