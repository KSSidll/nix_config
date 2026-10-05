import { createBinding, createComputed, createState, For, onCleanup } from "ags"
import Gtk from "gi://Gtk?version=4.0"
import NM from "gi://NM"
import Pango from "gi://Pango"
import { createConfirm } from "../confirm"
import { activation, ActivationError, client } from "../nm"
import { notify } from "../notifications/send"
import Panel from "../Panel"
import { closePanel, launch } from "../panels"
import { pickFile } from "../portal"
import Tile from "./Tile"

const vpnTypes: string[] = [NM.SETTING_VPN_SETTING_NAME, NM.SETTING_WIREGUARD_SETTING_NAME]

const { ACTIVATING, ACTIVATED, DEACTIVATING } = NM.ActiveConnectionState
const reasons = NM.ActiveConnectionStateReason

const failures = new Map<NM.ActiveConnectionStateReason, string>([
  [reasons.LOGIN_FAILED, "The server rejected the login."],
  [reasons.CONNECT_TIMEOUT, "The server didn't answer."],
  [reasons.SERVICE_START_TIMEOUT, "The VPN service didn't start in time."],
  [reasons.SERVICE_START_FAILED, "The VPN service couldn't start."],
  [reasons.SERVICE_STOPPED, "The VPN service stopped."],
  [reasons.IP_CONFIG_INVALID, "The server sent network settings that can't be used."],
])

// a dismissed password prompt or turning the VPN off isn't a failure to report
const quiet = [reasons.NO_SECRETS, reasons.USER_DISCONNECTED]

function report(connection: NM.RemoteConnection, error: unknown) {
  if (error instanceof ActivationError && quiet.includes(error.reason)) return
  const reason = error instanceof ActivationError ? failures.get(error.reason) : undefined
  console.error(`Failed to connect the VPN [${connection.get_id()}]: ${error}`)
  notify({
    app: "VPN",
    icon: "network-vpn-error-symbolic",
    summary: `${connection.get_id()} couldn't connect`,
    body: reason ?? String(error),
  }).catch((failure: unknown) => console.error(`Failed to report the VPN failure [${connection.get_id()}]: ${failure}`))
}

function connect(connection: NM.RemoteConnection) {
  client
    .activate_connection_async(connection, null, null, null)
    .then(activation)
    .catch((error: unknown) => report(connection, error))
}

function disconnect(active: NM.ActiveConnection) {
  client
    .deactivate_connection_async(active, null)
    .catch((error: unknown) => console.error(`Failed to disconnect the VPN [${active.id}]: ${error}`))
}

const isVpn = (connection: NM.Connection) => vpnTypes.includes(connection.get_connection_type() ?? "")

function vpnConnections() {
  return createBinding(client, "connections").as((all) =>
    all.filter(isVpn).sort((a, b) => (a.get_id() ?? "").localeCompare(b.get_id() ?? "")),
  )
}

// the VPNs that are up or on their way, by profile UUID
function vpnActive() {
  return createComputed(() => {
    const active = new Map<string, { connection: NM.ActiveConnection; state: NM.ActiveConnectionState }>()
    for (const it of createBinding(client, "activeConnections")()) {
      if (vpnTypes.includes(it.type)) active.set(it.uuid, { connection: it, state: createBinding(it, "state")() })
    }
    return active
  })
}

// the profile connected most recently, which the tile turns on
function lastUsed() {
  const connections = client.get_connections().filter(isVpn)
  const timestamp = (it: NM.Connection) => it.get_setting_connection()?.get_timestamp() ?? 0
  return connections.reduce<NM.RemoteConnection | null>((best, it) => (!best || timestamp(it) > timestamp(best) ? it : best), null)
}

export function vpnStatus() {
  const active = vpnActive()
  const states = active.as((it) => [...it.values()])
  const up = states.as((it) => it.filter((vpn) => vpn.state === ACTIVATED))

  // the theme's acquiring icon marks the state with opacity, which GTK drops when it recolors symbolic icons, so the
  // bar pulses the plain icon instead
  const connecting = createComputed(() => up().length === 0 && states().some((it) => it.state === ACTIVATING))
  const label = createComputed(() => {
    const connected = up()
    if (connected.length > 0) return connected.length === 1 ? connected[0].connection.id : `${connected.length} connected`
    return connecting() ? "Connecting…" : "Off"
  })
  return { label, active, connecting, on: states.as((it) => it.length > 0) }
}

export function VpnTile({ onDetails }: { onDetails: () => void }) {
  const { label, on, active } = vpnStatus()

  const toggle = () => {
    const current = [...active.get().values()]
    if (current.length > 0) return current.forEach((it) => disconnect(it.connection))
    const connection = lastUsed()
    if (connection) connect(connection)
    else onDetails()
  }

  return <Tile icon="network-vpn-symbolic" title="VPN" subtitle={label} active={on} onToggle={toggle} onDetails={onDetails} />
}

// a profile's name follows renames made in the editor
function connectionName(connection: NM.RemoteConnection) {
  const [name, setName] = createState(connection.get_id() ?? "")
  const handler = connection.connect("changed", () => setName(connection.get_id() ?? ""))
  onCleanup(() => connection.disconnect(handler))
  return name
}

function addFromFile() {
  closePanel()
  pickFile({
    title: "Add a VPN connection",
    filters: [
      { name: "VPN configurations", patterns: ["*.ovpn", "*.conf"] },
      { name: "All files", patterns: ["*"] },
    ],
  })
    // the editor finds the plugin that reads the file and opens the result for review before saving it
    .then((path) => path && launch("nm-connection-editor", `--import=${path}`))
    .catch((error: unknown) => console.error(`Failed to pick a VPN configuration: ${error}`))
}

function Connections() {
  const connections = vpnConnections()
  const active = vpnActive()
  const { armed, press: confirm } = createConfirm<string>()

  const press = (connection: NM.RemoteConnection) => {
    const current = active.get().get(connection.get_uuid() ?? "")
    if (current) disconnect(current.connection)
    else connect(connection)
  }

  const remove = (connection: NM.RemoteConnection) =>
    confirm(connection.get_uuid() ?? "", () =>
      connection
        .delete_async(null)
        .catch((error: unknown) => console.error(`Failed to remove the VPN [${connection.get_id()}]: ${error}`)),
    )

  return (
    <box orientation={Gtk.Orientation.VERTICAL}>
      <label cssClasses={["value"]} label="No VPN connections" visible={connections.as((it) => it.length === 0)} xalign={0} />
      <For each={connections}>
        {(connection) => {
          const uuid = connection.get_uuid() ?? ""
          const state = active.as((it) => it.get(uuid)?.state ?? null)
          const status = createComputed(() => {
            if (armed() === uuid) return "Remove? Click again"
            switch (state()) {
              case ACTIVATED: return "Connected"
              case ACTIVATING: return "Connecting…"
              case DEACTIVATING: return "Disconnecting…"
              default: return ""
            }
          })

          return (
            <box cssClasses={state.as((it) => (it === ACTIVATED ? ["row", "selected"] : ["row"]))} spacing={4}>
              <button hexpand onClicked={() => press(connection)}>
                <box spacing={8}>
                  <image iconName="network-vpn-symbolic" />
                  <label label={connectionName(connection)} hexpand xalign={0} ellipsize={Pango.EllipsizeMode.END} maxWidthChars={22} />
                  <label cssClasses={["value"]} label={status} />
                </box>
              </button>
              <button cssClasses={["icon-button"]} tooltipText="Edit" valign={Gtk.Align.CENTER} onClicked={() => launch("nm-connection-editor", `--edit=${uuid}`)}>
                <image iconName="document-edit-symbolic" />
              </button>
              <button
                cssClasses={armed.as((it) => (it === uuid ? ["icon-button", "armed"] : ["icon-button"]))}
                tooltipText="Remove"
                valign={Gtk.Align.CENTER}
                onClicked={() => remove(connection)}
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

export function VpnPage({ onBack }: { onBack: () => void }) {
  return (
    <Panel title="VPN" onBack={onBack} footer={[{ label: "Add from file…", onClicked: addFromFile }]}>
      <Connections />
    </Panel>
  )
}
