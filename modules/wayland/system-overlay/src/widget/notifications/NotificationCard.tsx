import { onCleanup } from "ags"
import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango"
import AstalNotifd from "gi://AstalNotifd"
import { hidePopup } from "./state"

const popupTimeout = 5000
export const popupWidth = 388

const urgencyClass = {
  [AstalNotifd.Urgency.LOW]: "low",
  [AstalNotifd.Urgency.NORMAL]: "normal",
  [AstalNotifd.Urgency.CRITICAL]: "critical",
}

// apps send either an icon name or a file path for icons and images
function Picture({ source, size, cssClasses }: { source: string; size: number; cssClasses: string[] }) {
  return source.startsWith("/") || source.startsWith("file://")
    ? <image cssClasses={cssClasses} file={source.replace(/^file:\/\//, "")} pixelSize={size} />
    : <image cssClasses={cssClasses} iconName={source} pixelSize={size} />
}

// bodies may carry Pango markup, but apps also send plain text with stray "<" or "&"
function isMarkup(text: string) {
  try {
    Pango.parse_markup(text, -1, "\0")
    return true
  } catch {
    return false
  }
}

// a popup hides itself after its timeout, paused while hovered; critical notifications stay until dismissed
function expireWhenIdle(card: Gtk.Widget, notification: AstalNotifd.Notification) {
  if (notification.urgency === AstalNotifd.Urgency.CRITICAL) return
  const timeout = notification.expireTimeout > 0 ? notification.expireTimeout : popupTimeout
  let source: number | null = null

  const start = () => {
    stop()
    source = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeout, () => {
      source = null
      hidePopup(notification.id)
      return GLib.SOURCE_REMOVE
    })
  }
  const stop = () => {
    if (source !== null) GLib.source_remove(source)
    source = null
  }

  const motion = new Gtk.EventControllerMotion()
  motion.connect("enter", stop)
  motion.connect("leave", start)
  card.add_controller(motion)
  // the timeout counts only while the popup is on screen
  card.connect("map", start)
  card.connect("unmap", stop)
  onCleanup(stop)
}

export default function NotificationCard({
  notification,
  popup = false,
  showApp = true,
}: {
  notification: AstalNotifd.Notification
  popup?: boolean
  showApp?: boolean
}) {
  const { appName, appIcon, desktopEntry, summary, body, image, actions } = notification
  const time = GLib.DateTime.new_from_unix_local(notification.time).format("%H:%M")!
  const defaultAction = actions.find((it) => it.id === "default")
  const buttons = actions.filter((it) => it.id !== "default")

  const invoke = (id: string) => {
    notification.invoke(id)
    notification.dismiss()
  }

  return (
    <box
      cssClasses={["notification", urgencyClass[notification.urgency], ...(popup ? ["popup"] : [])]}
      orientation={Gtk.Orientation.VERTICAL}
      spacing={6}
      widthRequest={popup ? popupWidth : -1}
      $={(self) => popup && expireWhenIdle(self, notification)}
    >
      {defaultAction && <Gtk.GestureClick onReleased={() => invoke(defaultAction.id)} />}
      <box cssClasses={["notification-header"]} spacing={6}>
        {showApp && (appIcon || desktopEntry) && <Picture source={appIcon || desktopEntry} size={14} cssClasses={["app-icon"]} />}
        {/* under a group heading the app is already named, so the summary takes its place */}
        <label
          cssClasses={[showApp ? "app-name" : "summary"]}
          label={showApp ? appName || "Notification" : summary}
          hexpand
          xalign={0}
          ellipsize={Pango.EllipsizeMode.END}
        />
        <label cssClasses={["time"]} label={time} />
        <button cssClasses={["icon-button", "close"]} tooltipText="Dismiss" onClicked={() => notification.dismiss()}>
          <image iconName="window-close-symbolic" />
        </button>
      </box>
      <box spacing={10}>
        {image && <Picture source={image} size={44} cssClasses={["image"]} />}
        <box orientation={Gtk.Orientation.VERTICAL} spacing={2} valign={Gtk.Align.CENTER} hexpand>
          {showApp && (
            <label cssClasses={["summary"]} label={summary} xalign={0} wrap wrapMode={Pango.WrapMode.WORD_CHAR} maxWidthChars={1} />
          )}
          {body && (
            <label
              cssClasses={["body"]}
              label={body}
              useMarkup={isMarkup(body)}
              xalign={0}
              wrap
              wrapMode={Pango.WrapMode.WORD_CHAR}
              maxWidthChars={1}
              lines={popup ? 4 : -1}
              ellipsize={popup ? Pango.EllipsizeMode.END : Pango.EllipsizeMode.NONE}
            />
          )}
        </box>
      </box>
      {buttons.length > 0 && (
        <box cssClasses={["actions"]} spacing={6} homogeneous>
          {buttons.map((action) => (
            <button cssClasses={["action"]} onClicked={() => invoke(action.id)}>
              <label label={action.label} ellipsize={Pango.EllipsizeMode.END} />
            </button>
          ))}
        </box>
      )}
    </box>
  )
}
