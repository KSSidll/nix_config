import Gio from "gi://Gio"
import GLib from "gi://GLib"

Gio._promisify(Gio.DBusConnection.prototype, "call", "call_finish")

let requests = 0

// Asks the desktop's file chooser portal for one file; resolves to its path, or to null when the chooser is dismissed.
export function pickFile({ title, filters }: { title: string; filters: { name: string; patterns: string[] }[] }) {
  const bus = Gio.DBus.session
  const token = `system_overlay_${++requests}`
  // the portal answers on a request object named after the caller and the token; subscribing before the call keeps a
  // quick answer from arriving first
  const caller = bus.get_unique_name()!.slice(1).replaceAll(".", "_")
  const request = `/org/freedesktop/portal/desktop/request/${caller}/${token}`

  return new Promise<string | null>((resolve, reject) => {
    const subscription = bus.signal_subscribe(
      "org.freedesktop.portal.Desktop",
      "org.freedesktop.portal.Request",
      "Response",
      request,
      null,
      Gio.DBusSignalFlags.NONE,
      (_connection, _sender, _path, _iface, _signal, parameters) => {
        bus.signal_unsubscribe(subscription)
        const [response, results] = parameters.deepUnpack() as [number, Record<string, GLib.Variant>]
        const [uri] = response === 0 ? (results.uris?.deepUnpack() as string[] | undefined) ?? [] : []
        resolve(uri ? Gio.File.new_for_uri(uri).get_path() : null)
      },
    )

    const options = {
      handle_token: GLib.Variant.new_string(token),
      filters: new GLib.Variant(
        "a(sa(us))",
        filters.map(({ name, patterns }) => [name, patterns.map((pattern) => [0, pattern])]),
      ),
    }
    bus
      .call(
        "org.freedesktop.portal.Desktop",
        "/org/freedesktop/portal/desktop",
        "org.freedesktop.portal.FileChooser",
        "OpenFile",
        new GLib.Variant("(ssa{sv})", ["", title, options]),
        null,
        Gio.DBusCallFlags.NONE,
        -1,
        null,
      )
      .catch((error: unknown) => {
        bus.signal_unsubscribe(subscription)
        reject(error)
      })
  })
}
