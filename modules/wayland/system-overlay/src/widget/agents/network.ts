import Gio from "gi://Gio"
import GLib from "gi://GLib"
import { callSystem, serveAgent } from "./dbus"
import { Field, prompt } from "./prompt"
import { askVpnSecrets } from "./vpn"

// NetworkManager has no UI of its own: when a connection needs a secret it doesn't have, or one it has was rejected,
// it asks a registered secret agent. This one prompts in the overlay; secrets stay stored by NetworkManager itself.
// It implements the agent's D-Bus interface directly: libnm's NM.SecretAgentOld can't be subclassed from GJS,
// whose vfunc overrides can't receive the callback get_secrets replies through.

const agentInterface = `
<node>
  <interface name="org.freedesktop.NetworkManager.SecretAgent">
    <method name="GetSecrets">
      <arg name="connection" type="a{sa{sv}}" direction="in"/>
      <arg name="connection_path" type="o" direction="in"/>
      <arg name="setting_name" type="s" direction="in"/>
      <arg name="hints" type="as" direction="in"/>
      <arg name="flags" type="u" direction="in"/>
      <arg name="secrets" type="a{sa{sv}}" direction="out"/>
    </method>
    <method name="CancelGetSecrets">
      <arg name="connection_path" type="o" direction="in"/>
      <arg name="setting_name" type="s" direction="in"/>
    </method>
    <method name="SaveSecrets">
      <arg name="connection" type="a{sa{sv}}" direction="in"/>
      <arg name="connection_path" type="o" direction="in"/>
    </method>
    <method name="DeleteSecrets">
      <arg name="connection" type="a{sa{sv}}" direction="in"/>
      <arg name="connection_path" type="o" direction="in"/>
    </method>
  </interface>
</node>`

const errorPrefix = "org.freedesktop.NetworkManager.SecretAgent"

// NMSecretAgentGetSecretsFlags
const allowInteraction = 0x1
const requestNew = 0x2

// NMSecretAgentCapabilities: VPN secret requests carry the plugin's hints, such as a one-time code it asks for
const vpnHints = 0x1

type Settings = Record<string, Record<string, unknown>>

// the Wi-Fi and 802.1X secrets this agent prompts for itself; VPN secrets go through their plugin, and anything else
// (certificates) is declined
function fieldsFor(connection: Settings, settingName: string): Field[] | null {
  if (settingName === "802-11-wireless-security") {
    switch (connection[settingName]?.["key-mgmt"]) {
      case "wpa-psk":
      case "sae":
        return [{ key: "psk", label: "Password", secret: true }]
      case "none":
        return [{ key: "wep-key0", label: "Key", secret: true }]
      default:
        return null
    }
  }
  if (settingName === "802-1x") {
    return [
      { key: "identity", label: "Username", secret: false },
      { key: "password", label: "Password", secret: true },
    ]
  }
  return null
}

function askSecrets(connection: Settings, settingName: string, flags: number, reply: (secrets: Record<string, GLib.Variant> | null) => void) {
  const fields = fieldsFor(connection, settingName)
  if (!fields || !(flags & allowInteraction)) return null
  return prompt({
    title: String(connection.connection?.id ?? "Network"),
    message: flags & requestNew ? "The saved credentials were rejected. Enter them again." : "This network needs credentials.",
    fields,
    actions: [{ id: "connect", label: "Connect" }],
    reply: (answer) =>
      reply(answer && Object.fromEntries(Object.entries(answer.values).map(([key, value]) => [key, GLib.Variant.new_string(value)]))),
  })
}

const pending: { path: string; settingName: string; close: () => void }[] = []

const agent = {
  // GJS unpacks the arguments one level, so the {sv} values arrive as variants
  GetSecretsAsync(
    [packed, path, settingName, hints, flags]: [Record<string, Record<string, GLib.Variant>>, string, string, string[], number],
    invocation: Gio.DBusMethodInvocation,
  ) {
    const connection: Settings = Object.fromEntries(
      Object.entries(packed).map(([name, setting]) => [
        name,
        Object.fromEntries(Object.entries(setting).map(([key, value]) => [key, value.recursiveUnpack()])),
      ]),
    )

    let request: (typeof pending)[number] | null = null
    let answered = false
    const finish = (secrets: Record<string, GLib.Variant> | null, error = "NoSecrets") => {
      if (answered) return
      answered = true
      if (request) pending.splice(pending.indexOf(request), 1)
      if (secrets) invocation.return_value(new GLib.Variant("(a{sa{sv}})", [{ [settingName]: secrets }]))
      else invocation.return_dbus_error(`${errorPrefix}.${error}`, `no secrets for [${settingName}]`)
    }

    const close =
      settingName === "vpn"
        ? askVpnSecrets({ connection, path, hints, flags }, (outcome) =>
            "secrets" in outcome
              ? finish({ secrets: new GLib.Variant("a{ss}", outcome.secrets) })
              : finish(null, outcome.canceled ? "UserCanceled" : "NoSecrets"),
          )
        : askSecrets(connection, settingName, flags, (secrets) => finish(secrets, "UserCanceled"))
    if (!close) return finish(null)
    if (answered) return
    request = { path, settingName, close }
    pending.push(request)
  },

  // NetworkManager gave up on the request (timeout, or the attempt was canceled)
  CancelGetSecrets(path: string, settingName: string) {
    pending.find((it) => it.path === path && it.settingName === settingName)?.close()
  },

  // secrets are stored by NetworkManager with the profile, not by this agent
  SaveSecrets() {},
  DeleteSecrets() {},
}

export function startNetworkAgent() {
  serveAgent({
    description: "NetworkManager secret agent",
    service: "org.freedesktop.NetworkManager",
    path: "/org/freedesktop/NetworkManager/SecretAgent",
    xml: agentInterface,
    implementation: agent,
    register: () =>
      callSystem(
        "org.freedesktop.NetworkManager",
        "/org/freedesktop/NetworkManager/AgentManager",
        "org.freedesktop.NetworkManager.AgentManager",
        "RegisterWithCapabilities",
        new GLib.Variant("(su)", ["io.astal.system-overlay", vpnHints]),
      ),
  })
}
