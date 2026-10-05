import { createBinding, createComputed, For } from "ags"
import Gtk from "gi://Gtk?version=4.0"
import NM from "gi://NM"
import Pango from "gi://Pango"
import AstalNetwork from "gi://AstalNetwork"
import { activation, client } from "../nm"
import Panel from "../Panel"
import { launch } from "../panels"
import Tile from "./Tile"

// NetworkManager completes the profile from the access point, asks the secret agent for any password, and saves the
// profile before it knows whether the join works; a failed join must not leave it behind
async function join(client: NM.Client, wifi: AstalNetwork.Wifi, ap: AstalNetwork.AccessPoint) {
  const active = await client.add_and_activate_connection_async(NM.SimpleConnection.new(), wifi.device, ap.get_path(), null)
  try {
    await activation(active)
  } catch (error) {
    await (active.connection as NM.RemoteConnection).delete_async(null)
    throw error
  }
}

function savedConnection(client: NM.Client, ssid: string) {
  const decoder = new TextDecoder()
  return client.get_connections().find((connection) => {
    const saved = connection.get_setting_wireless()?.get_ssid()
    return saved !== null && saved !== undefined && decoder.decode(saved.toArray()) === ssid
  }) ?? null
}

// passwords are never asked here: NetworkManager asks the secret agent whenever one is missing or rejected
function connect(client: NM.Client, wifi: AstalNetwork.Wifi, ap: AstalNetwork.AccessPoint) {
  const saved = savedConnection(client, ap.ssid ?? "")
  const attempt = saved
    ? client.activate_connection_async(saved, wifi.device, ap.get_path(), null).then(activation)
    : join(client, wifi, ap)
  attempt.catch((error: unknown) => console.error(`Failed to connect [ssid: ${ap.ssid}]: ${error}`))
}

function AccessPoints({ wifi, client }: { wifi: AstalNetwork.Wifi; client: NM.Client }) {
  const active = createBinding(wifi, "activeAccessPoint")

  // a network is often broadcast by several access points; list it once, by its strongest
  const networks = createBinding(wifi, "accessPoints").as((all) => {
    const strongest = new Map<string, AstalNetwork.AccessPoint>()
    for (const ap of all) {
      if (!ap.ssid) continue
      const known = strongest.get(ap.ssid)
      if (!known || ap.strength > known.strength) strongest.set(ap.ssid, ap)
    }
    return [...strongest.values()].sort((a, b) => b.strength - a.strength)
  })

  return (
    <box orientation={Gtk.Orientation.VERTICAL}>
      <For each={networks}>
        {(ap) => (
          <button
            cssClasses={active.as((it) => (it?.ssid === ap.ssid ? ["row", "selected"] : ["row"]))}
            onClicked={() => active.get()?.ssid !== ap.ssid && connect(client, wifi, ap)}
          >
            <box spacing={8}>
              <image iconName={createBinding(ap, "iconName")} />
              <label label={ap.ssid ?? ""} hexpand xalign={0} ellipsize={Pango.EllipsizeMode.END} maxWidthChars={26} />
              <image iconName="network-wireless-encrypted-symbolic" visible={ap.requiresPassword} />
            </box>
          </button>
        )}
      </For>
    </box>
  )
}

// built from the device state alone: without a connectivity check URI, NetworkManager's connectivity is a guess
const { CONNECTED, CONNECTING } = AstalNetwork.Internet

const signalLevels: [number, string][] = [[80, "excellent"], [55, "good"], [30, "ok"], [5, "weak"], [-1, "none"]]

function wifiIcon(enabled: boolean, internet: AstalNetwork.Internet, strength: number) {
  if (!enabled) return "network-wireless-disabled-symbolic"
  if (internet === CONNECTING) return "network-wireless-acquiring-symbolic"
  if (internet !== CONNECTED) return "network-wireless-offline-symbolic"
  const [, level] = signalLevels.find(([threshold]) => strength > threshold)!
  return `network-wireless-signal-${level}-symbolic`
}

function wiredIcon(internet: AstalNetwork.Internet) {
  if (internet === CONNECTING) return "network-wired-acquiring-symbolic"
  if (internet !== CONNECTED) return "network-wired-disconnected-symbolic"
  return "network-wired-symbolic"
}

const network = AstalNetwork.get_default()

export function networkStatus() {
  const { wifi, wired } = network
  const primary = createBinding(network, "primary")
  const wifiState = wifi && {
    enabled: createBinding(wifi, "enabled"),
    internet: createBinding(wifi, "internet"),
    strength: createBinding(wifi, "strength"),
    ssid: createBinding(wifi, "ssid"),
  }
  const wiredInternet = wired && createBinding(wired, "internet")

  const icon = createComputed(() => {
    switch (primary()) {
      case AstalNetwork.Primary.WIFI:
        return wifiIcon(wifiState!.enabled(), wifiState!.internet(), wifiState!.strength())
      case AstalNetwork.Primary.WIRED:
        return wiredIcon(wiredInternet!())
      default:
        return wifiState && !wifiState.enabled() ? "network-wireless-disabled-symbolic" : "network-offline-symbolic"
    }
  })
  const label = createComputed(() => {
    switch (primary()) {
      case AstalNetwork.Primary.WIFI: return wifiState!.ssid() ?? "Wi-Fi"
      case AstalNetwork.Primary.WIRED: return "Wired"
      default: return wifiState && !wifiState.enabled() ? "Off" : "Disconnected"
    }
  })
  return { icon, label }
}

export function NetworkTile({ onDetails }: { onDetails: () => void }) {
  const { wifi } = network
  const { icon, label } = networkStatus()

  return (
    <Tile
      icon={icon}
      title={wifi ? "Wi-Fi" : "Network"}
      subtitle={label}
      active={wifi ? createBinding(wifi, "enabled") : createBinding(network, "primary").as((it) => it === AstalNetwork.Primary.WIRED)}
      onToggle={wifi ? () => wifi.set_enabled(!wifi.enabled) : onDetails}
      onDetails={onDetails}
    />
  )
}

export function NetworkPage({ onBack }: { onBack: () => void }) {
  const { wifi } = network
  wifi?.scan()

  return (
    <Panel
      title={wifi ? "Wi-Fi" : "Network"}
      onBack={onBack}
      control={wifi && <switch valign={Gtk.Align.CENTER} active={createBinding(wifi, "enabled")} onNotifyActive={({ active }) => wifi.set_enabled(active)} />}
      footer={[{ label: "Connections…", onClicked: () => launch("nm-connection-editor") }]}
    >
      {wifi && <AccessPoints wifi={wifi} client={client} />}
    </Panel>
  )
}
