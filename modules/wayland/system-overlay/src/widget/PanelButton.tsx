import { Accessor, createComputed } from "ags"
import Gdk from "gi://Gdk?version=4.0"
import Gtk from "gi://Gtk?version=4.0"
import { open, openPanel, PanelContent, switchOnHover, togglePanel } from "./panels"
import { ScrollSteps, scrollSteps } from "./scroll"

type Text = string | Accessor<string>

const accessor = <T,>(value: T | Accessor<T>) => (value instanceof Accessor ? value : () => value)

export default function PanelButton({
  panel,
  tooltip,
  cssClasses = [],
  onScroll,
  onMiddleClick,
  onSetup,
  children,
}: {
  panel: PanelContent
  tooltip?: Text
  cssClasses?: string[] | Accessor<string[]>
  onScroll?: ScrollSteps
  onMiddleClick?: () => void
  onSetup?: (button: Gtk.Button) => void
  children: JSX.Element
}) {
  let button: Gtk.Button | null = null
  const isOpen = open.as((it) => it !== null && it.anchor === button)
  const classes = accessor(cssClasses)
  const tooltipText = accessor(tooltip)

  return (
    <button
      cssClasses={createComputed(() => ["panel-button", ...classes(), ...(isOpen() ? ["open"] : [])])}
      tooltipText={createComputed(() => (isOpen() ? null : (tooltipText() ?? null)) as string)}
      onClicked={(self) => togglePanel(self, panel)}
      $={(self) => {
        button = self
        switchOnHover(self, () => openPanel(self, panel))
        onSetup?.(self)
      }}
    >
      {onScroll && scrollSteps(onScroll)}
      {onMiddleClick && <Gtk.GestureClick button={Gdk.BUTTON_MIDDLE} onPressed={onMiddleClick} />}
      {children}
    </button>
  )
}
