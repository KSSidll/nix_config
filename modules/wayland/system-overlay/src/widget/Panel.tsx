import { Accessor } from "ags"
import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango"

export default function Panel({
  title,
  onBack,
  control,
  footer,
  children,
}: {
  title: string | Accessor<string>
  onBack?: () => void
  control?: JSX.Element | null
  footer?: { label: string; onClicked: () => void }[]
  children?: JSX.Element | JSX.Element[] | null
}) {
  return (
    <box cssClasses={["panel"]} orientation={Gtk.Orientation.VERTICAL} spacing={8}>
      <box cssClasses={["panel-heading"]} spacing={8}>
        {onBack && (
          <button cssClasses={["icon-button"]} tooltipText="Back" onClicked={onBack}>
            <image iconName="go-previous-symbolic" />
          </button>
        )}
        <label cssClasses={["heading"]} label={title} hexpand xalign={0} ellipsize={Pango.EllipsizeMode.END} />
        {control}
      </box>
      {children && <Gtk.Separator />}
      {children}
      {footer && footer.length > 0 && <Gtk.Separator />}
      {footer?.map((action) => (
        <button cssClasses={["row"]} onClicked={action.onClicked}>
          <label label={action.label} xalign={0} />
        </button>
      ))}
    </box>
  )
}
