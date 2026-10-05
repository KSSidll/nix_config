import { createBinding, createComputed, createState, For } from "ags"
import { execAsync } from "ags/process"
import Gdk from "gi://Gdk?version=4.0"
import Gio from "gi://Gio"
import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango"
import AstalBluetooth from "gi://AstalBluetooth"
import { devicePath, removeDevice } from "../bluez"
import { createConfirm } from "../confirm"
import Panel from "../Panel"
import { changeSetting, settings } from "../settings"
import Tile from "./Tile"

Gio._promisify(AstalBluetooth.Device.prototype, "connect_device", "connect_device_finish")
Gio._promisify(AstalBluetooth.Device.prototype, "disconnect_device", "disconnect_device_finish")

const bluetooth = AstalBluetooth.get_default()
const pairingTimeoutMs = 60_000

// AstalBluetooth's pair() blocks the bar until the device answers, so bluez's Pair is called directly, without waiting
async function pair(device: AstalBluetooth.Device) {
  const path = await devicePath(device.address)
  await Gio.DBus.system.call("org.bluez", path, "org.bluez.Device1", "Pair", null, null, Gio.DBusCallFlags.NONE, pairingTimeoutMs, null)
  await device.connect_device()
}

// bluez refuses to power a radio that rfkill blocks, and AstalBluetooth drops that error; systemd restores the block
// across boots, so turning Bluetooth on lifts it first
function setPowered(powered: boolean) {
  const adapter = bluetooth.adapter
  if (!adapter) return
  const unblocked = powered ? execAsync(["rfkill", "unblock", "bluetooth"]) : Promise.resolve("")
  unblocked
    .then(() => adapter.set_powered(powered))
    .catch((error: unknown) => console.error(`Failed to turn Bluetooth ${powered ? "on" : "off"} [${adapter.address}]: ${error}`))
}

function connectedDevices() {
  return createComputed(() => createBinding(bluetooth, "devices")().filter((it) => createBinding(it, "connected")()))
}

export function bluetoothStatus() {
  const powered = createBinding(bluetooth, "isPowered")
  const connected = connectedDevices()

  const icon = createComputed(() => {
    if (!powered()) return "bluetooth-disabled-symbolic"
    return connected().length > 0 ? "bluetooth-active-symbolic" : "bluetooth-symbolic"
  })
  const label = createComputed(() => {
    const devices = connected()
    if (!powered()) return "Off"
    if (devices.length === 0) return "On"
    return devices.length === 1 ? devices[0].alias : `${devices.length} devices`
  })
  return { icon, label, connected: connected.as((it) => it.length > 0) }
}

export function BluetoothTile({ onDetails }: { onDetails: () => void }) {
  const { icon, label } = bluetoothStatus()

  return (
    <Tile
      icon={icon}
      title="Bluetooth"
      subtitle={label}
      active={createBinding(bluetooth, "isPowered")}
      onToggle={() => setPowered(!bluetooth.isPowered)}
      onDetails={onDetails}
    />
  )
}

function deviceIcon(device: AstalBluetooth.Device) {
  const icon = `${device.icon}-symbolic`
  return device.icon && Gtk.IconTheme.get_for_display(Gdk.Display.get_default()!).has_icon(icon) ? icon : "bluetooth-symbolic"
}

function Devices({ paired }: { paired: boolean }) {
  const [pairing, setPairing] = createState(new Set<string>())
  const { armed, press: confirm } = createConfirm<string>()

  // unnamed devices are mostly nearby beacons, which can't be connected to
  const devices = createComputed(() =>
    createBinding(bluetooth, "devices")()
      .filter((it) => it.name && createBinding(it, "paired")() === paired)
      .sort((a, b) => a.alias.localeCompare(b.alias)),
  )

  const press = (device: AstalBluetooth.Device) => {
    if (device.connecting || pairing.get().has(device.address)) return
    const [action, attempt] = device.connected
      ? ["disconnect", device.disconnect_device()]
      : device.paired
        ? ["connect", device.connect_device()]
        : ["pair", pair(device)]
    if (action === "pair") setPairing(new Set([...pairing.get(), device.address]))
    attempt
      .catch((error: unknown) => console.error(`Failed to ${action} [${device.address}, name: ${device.alias}]: ${error}`))
      .finally(() => {
        const remaining = new Set(pairing.get())
        if (remaining.delete(device.address)) setPairing(remaining)
      })
  }

  const forget = (device: AstalBluetooth.Device) =>
    confirm(device.address, () =>
      removeDevice(device.address).catch((error: unknown) =>
        console.error(`Failed to forget [${device.address}, name: ${device.alias}]: ${error}`),
      ),
    )

  return (
    <box orientation={Gtk.Orientation.VERTICAL}>
      <For each={devices}>
        {(device) => {
          const connected = createBinding(device, "connected")
          const status = createComputed(() => {
            if (armed() === device.address) return "Forget? Click again"
            if (pairing().has(device.address)) return "Pairing…"
            if (createBinding(device, "connecting")()) return "Connecting…"
            if (!connected()) return ""
            const battery = createBinding(device, "batteryPercentage")()
            return battery >= 0 ? `${Math.round(battery * 100)}%` : "Connected"
          })

          return (
            <box cssClasses={connected.as((it) => (it ? ["row", "selected"] : ["row"]))} spacing={4}>
              <button hexpand onClicked={() => press(device)}>
                <box spacing={8}>
                  <image iconName={deviceIcon(device)} />
                  <label label={createBinding(device, "alias")} hexpand xalign={0} ellipsize={Pango.EllipsizeMode.END} maxWidthChars={26} />
                  <label cssClasses={["value"]} label={status} />
                </box>
              </button>
              <button
                cssClasses={armed.as((it) => (it === device.address ? ["icon-button", "armed"] : ["icon-button"]))}
                tooltipText="Forget"
                visible={createBinding(device, "paired")}
                valign={Gtk.Align.CENTER}
                onClicked={() => forget(device)}
              >
                <image iconName="user-trash-symbolic" />
              </button>
            </box>
          )
        }}
      </For>
    </box>
  )
}

// The Bluetooth page makes this machine visible to devices pairing from their side, unless the setting forbids it,
// and the pairing page searches for devices to pair with; both stop once their page is off screen.
const shown = { page: false, pairing: false }

function syncAdapter() {
  const adapter = bluetooth.adapter
  if (!adapter?.powered) return
  const search = shown.pairing
  const visible = (shown.page || shown.pairing) && settings.get().bluetoothVisible
  try {
    if (search && !adapter.discovering) adapter.start_discovery()
    else if (!search && adapter.discovering) adapter.stop_discovery()
    if (adapter.discoverable !== visible) adapter.discoverable = visible
  } catch (error) {
    console.error(`Failed to update discovery [${adapter.address}, searching: ${search}, visible: ${visible}]: ${error}`)
  }
}

bluetooth.connect("notify::is-powered", syncAdapter)
settings.subscribe(syncAdapter)

const trackShown = (key: keyof typeof shown) => (page: Gtk.Widget) => {
  const update = () => {
    shown[key] = page.get_mapped()
    syncAdapter()
  }
  page.connect("map", update)
  page.connect("unmap", update)
}

export function BluetoothPage({ onBack, onPairNew }: { onBack: () => void; onPairNew: () => void }) {
  const adapter = createBinding(bluetooth, "adapter")
  const powered = createBinding(bluetooth, "isPowered")
  const visible = settings.as((it) => it.bluetoothVisible)

  return (
    <box $={trackShown("page")}>
      <Panel
        title="Bluetooth"
        onBack={onBack}
        control={<switch valign={Gtk.Align.CENTER} active={powered} sensitive={adapter.as(Boolean)} onNotifyActive={({ active }) => active !== bluetooth.isPowered && setPowered(active)} />}
      >
        <box orientation={Gtk.Orientation.VERTICAL}>
          <label
            cssClasses={["value"]}
            label={adapter.as((it) => (it ? "Bluetooth is off" : "No Bluetooth adapter"))}
            visible={createComputed(() => !powered())}
            xalign={0}
          />
          <box orientation={Gtk.Orientation.VERTICAL} visible={powered}>
            <Devices paired />
            <button cssClasses={["row"]} onClicked={onPairNew}>
              <box spacing={8}>
                <image iconName="list-add-symbolic" />
                <label label="Pair new device" hexpand xalign={0} />
                <image iconName="go-next-symbolic" />
              </box>
            </button>
            <box cssClasses={["setting"]}>
              <label label="Visible to nearby devices" hexpand xalign={0} />
              <switch
                valign={Gtk.Align.CENTER}
                active={visible}
                onNotifyActive={({ active }) => active !== settings.get().bluetoothVisible && changeSetting("bluetoothVisible", active)}
              />
            </box>
          </box>
        </box>
      </Panel>
    </box>
  )
}

export function BluetoothPairPage({ onBack }: { onBack: () => void }) {
  return (
    <box $={trackShown("pairing")}>
      <Panel title="Pair new device" onBack={onBack}>
        <box orientation={Gtk.Orientation.VERTICAL}>
          <label
            cssClasses={["value"]}
            wrap
            maxWidthChars={40}
            xalign={0}
            label="Searching. A device pairing from its own side may not get through until you go back."
          />
          <Devices paired={false} />
        </box>
      </Panel>
    </box>
  )
}
