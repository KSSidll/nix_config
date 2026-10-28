import Gio from "gi://Gio"
import GLib from "gi://GLib"

Gio._promisify(Gio.DBusConnection.prototype, "call", "call_finish")

// notification urgency hints
export const Urgency = { normal: 1, critical: 2 } as const

// The overlay's own notifications go through the notification server, which is this overlay, so they get the usual
// popup, history and Do not disturb handling.
const call = (method: string, parameters: GLib.Variant) =>
  Gio.DBus.session.call(
    "org.freedesktop.Notifications",
    "/org/freedesktop/Notifications",
    "org.freedesktop.Notifications",
    method,
    parameters,
    null,
    Gio.DBusCallFlags.NONE,
    -1,
    null,
  )

export type Action = { id: string; label: string; run: () => void }

// the actions of open notifications, by notification id
const handlers = new Map<number, Map<string, () => void>>()

let subscribed = false

function subscribe() {
  if (subscribed) return
  subscribed = true
  const on = (member: string, handle: (parameters: GLib.Variant) => void) =>
    Gio.DBus.session.signal_subscribe(
      null,
      "org.freedesktop.Notifications",
      member,
      "/org/freedesktop/Notifications",
      null,
      Gio.DBusSignalFlags.NONE,
      (_connection, _sender, _path, _iface, _member, parameters) => handle(parameters!),
    )
  on("ActionInvoked", (parameters) => {
    const [id, action] = parameters.deepUnpack() as [number, string]
    handlers.get(id)?.get(action)?.()
  })
  on("NotificationClosed", (parameters) => {
    const [id] = parameters.deepUnpack() as [number, number]
    handlers.delete(id)
  })
}

// resolves to the notification's id, which a later one can replace
export async function notify({ app, icon, summary, body, image, urgency = Urgency.normal, replaces = 0, actions = [] }: {
  app: string
  icon: string
  summary: string
  body: string
  // a file shown in the notification, beside its text
  image?: string
  urgency?: number
  replaces?: number
  actions?: Action[]
}) {
  if (actions.length > 0) subscribe()
  const reply = await call(
    "Notify",
    new GLib.Variant("(susssasa{sv}i)", [
      app,
      replaces,
      icon,
      summary,
      body,
      actions.flatMap((it) => [it.id, it.label]),
      {
        urgency: GLib.Variant.new_byte(urgency),
        ...(image ? { "image-path": GLib.Variant.new_string(image) } : {}),
      },
      -1,
    ]),
  )
  const [id] = reply.deepUnpack() as [number]
  if (actions.length > 0) handlers.set(id, new Map(actions.map((it) => [it.id, it.run])))
  else handlers.delete(id)
  return id
}

export async function closeNotification(id: number) {
  await call("CloseNotification", new GLib.Variant("(u)", [id]))
}
