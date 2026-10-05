import Gio from "gi://Gio"
import GLib from "gi://GLib"

Gio._promisify(Gio.DBusConnection.prototype, "call", "call_finish")

export function callSystem(name: string, path: string, iface: string, method: string, parameters: GLib.Variant | null) {
  return Gio.DBus.system.call(name, path, iface, method, parameters, null, Gio.DBusCallFlags.NONE, -1, null)
}

// Exports an agent on the system bus and registers it with its service, again whenever the service (re)appears:
// registrations live as long as the service's process.
export function serveAgent({ description, service, path, xml, implementation, register }: {
  description: string
  service: string
  path: string
  xml: string
  implementation: object
  register: () => Promise<unknown>
}) {
  const exported = Gio.DBusExportedObject.wrapJSObject(xml, implementation)
  let isExported = false

  // the watch keeps this callback, and through it the wrapper, for the bar's lifetime: GJS unexports a wrapper once
  // it is garbage collected
  const appeared = () => {
    if (!isExported) {
      exported.export(Gio.DBus.system, path)
      isExported = true
    }
    register().catch((error: unknown) => console.error(`Failed to register the ${description} [${service}]: ${error}`))
  }
  Gio.bus_watch_name_on_connection(Gio.DBus.system, service, Gio.BusNameWatcherFlags.NONE, appeared, null)
}
