import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { callSystem } from "./agents/dbus"

// bluez device paths end in dev_AA_BB_CC_DD_EE_FF, under their adapter's path
export const addressOf = (path: string) => path.split("/").pop()!.replace(/^dev_/, "").replaceAll("_", ":")
export const adapterOf = (path: string) => path.slice(0, path.lastIndexOf("/"))

export async function devicePath(address: string) {
  const reply = await Gio.DBus.system.call(
    "org.bluez", "/", "org.freedesktop.DBus.ObjectManager", "GetManagedObjects",
    null, new GLib.VariantType("(a{oa{sa{sv}}})"), Gio.DBusCallFlags.NONE, -1, null,
  )
  const [objects] = reply.recursiveUnpack() as [Record<string, Record<string, { Address?: string }>>]
  const path = Object.keys(objects).find((it) => objects[it]["org.bluez.Device1"]?.Address === address)
  if (!path) throw new Error("bluez does not know the device")
  return path
}

// removes the device with its pairing keys; bluez disconnects it first
export async function removeDevice(address: string) {
  const path = await devicePath(address)
  await callSystem("org.bluez", adapterOf(path), "org.bluez.Adapter1", "RemoveDevice", new GLib.Variant("(o)", [path]))
}
