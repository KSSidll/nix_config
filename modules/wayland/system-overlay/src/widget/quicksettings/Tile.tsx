import { Accessor } from "ags"
import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango"

type Text = string | Accessor<string>

export default function Tile({
  icon,
  title,
  subtitle,
  active,
  onToggle,
  onDetails,
}: {
  icon: Text
  title: Text
  subtitle?: Text
  active?: Accessor<boolean>
  onToggle: () => void
  onDetails?: () => void
}) {
  return (
    <box cssClasses={active ? active.as((it) => (it ? ["tile", "active"] : ["tile"])) : ["tile"]} hexpand>
      <button cssClasses={["tile-toggle"]} hexpand tooltipText={subtitle} onClicked={onToggle}>
        <box spacing={10}>
          <image iconName={icon} />
          <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER}>
            <label cssClasses={["tile-title"]} label={title} xalign={0} ellipsize={Pango.EllipsizeMode.END} maxWidthChars={1} hexpand />
            {subtitle !== undefined && (
              <label cssClasses={["tile-subtitle"]} label={subtitle} xalign={0} ellipsize={Pango.EllipsizeMode.END} maxWidthChars={1} hexpand />
            )}
          </box>
        </box>
      </button>
      {onDetails && (
        <button cssClasses={["tile-details"]} tooltipText="More" onClicked={onDetails}>
          <image iconName="go-next-symbolic" />
        </button>
      )}
    </box>
  )
}
