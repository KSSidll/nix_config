import Gio from "gi://Gio"
import GLib from "gi://GLib"

Gio._promisify(Gio.DBusConnection.prototype, "call", "call_finish")

// the file manager's window on the file's folder, with the file selected
export function showInFiles(file: string) {
  Gio.DBus.session
    .call(
      "org.freedesktop.FileManager1",
      "/org/freedesktop/FileManager1",
      "org.freedesktop.FileManager1",
      "ShowItems",
      new GLib.Variant("(ass)", [[Gio.File.new_for_path(file).get_uri()], ""]),
      null,
      Gio.DBusCallFlags.NONE,
      -1,
      null,
    )
    .catch((error: unknown) => console.error(`Failed to show a file [${file}]: ${error}`))
}
