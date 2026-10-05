import Gio from "gi://Gio"
import GLib from "gi://GLib"
import NM from "gi://NM"
import { activation, client } from "../nm"
import { prompt } from "./prompt"

// NetworkManager only knows that a VPN needs secrets; which ones, and how to ask for them, is up to the plugin's auth
// dialog. In external UI mode the dialog just describes the fields and the overlay asks for them; a plugin without
// that mode shows its own window.

Gio._promisify(Gio.Subprocess.prototype, "communicate_utf8_async", "communicate_utf8_finish")

// NMSecretAgentGetSecretsFlags
const allowInteraction = 0x1
const requestNew = 0x2

const uiGroup = "VPN Plugin UI"

type VpnSetting = { "service-type"?: string; data?: Record<string, string>; secrets?: Record<string, string> }

type Field = { key: string; label: string; value: string; secret: boolean; ask: boolean }

export type Outcome = { secrets: Record<string, string> } | { canceled: boolean }

// the dialog reads the profile's data and secrets from stdin, up to DONE; a dialog with its own window then waits for
// QUIT after printing its answer, so that comes along too
function details(vpn: VpnSetting) {
  const items = (kind: string, values: Record<string, string> = {}) =>
    Object.entries(values).map(([key, value]) => `${kind}_KEY=${key}\n${kind}_VAL=${value}\n\n`).join("")
  return `${items("DATA", vpn.data)}${items("SECRET", vpn.secrets)}DONE\n\nQUIT\n\n`
}

function parseFields(output: string) {
  const file = new GLib.KeyFile()
  file.load_from_data(output, new TextEncoder().encode(output).length, GLib.KeyFileFlags.NONE)
  const read = <T>(get: () => T, fallback: T) => {
    try {
      return get()
    } catch {
      return fallback
    }
  }
  const [groups] = file.get_groups()
  const fields: Field[] = groups
    .filter((group) => group !== uiGroup)
    .map((group) => ({
      // dynamic challenges are named after the hint that asked for them, "x-dynamic-challenge(-echo):<secret>"
      key: group.startsWith("x-") ? group.slice(group.indexOf(":") + 1) : group,
      label: read(() => file.get_string(group, "Label"), group),
      value: read(() => file.get_string(group, "Value"), ""),
      secret: read(() => file.get_boolean(group, "IsSecret"), false) && !read(() => file.get_boolean(group, "ForceEcho"), false),
      ask: read(() => file.get_boolean(group, "ShouldAsk"), false),
    }))
  return { description: read(() => file.get_string(uiGroup, "Description"), ""), fields }
}

// a dialog with its own window answers in key and value lines, ended by an empty line
function parsePairs(output: string) {
  const lines = output.split("\n")
  const secrets: Record<string, string> = {}
  for (let i = 0; i + 1 < lines.length && lines[i] !== ""; i += 2) secrets[lines[i]] = lines[i + 1]
  return secrets
}

const secretFlags = (vpn: NM.SettingVpn, key: string) => Number(vpn.get_data_item(`${key}-flags`) ?? NM.SettingSecretFlags.NONE)

// Secrets that are system-owned NetworkManager stores in the profile, readable only by root; agent-owned ones it
// leaves to the agent, which keeps none, so they are asked for on every connect. Only secrets that got the VPN up are
// kept.
async function remember(path: string, secrets: Record<string, string>, keys: string[], keep: boolean) {
  const remote = client.get_connection_by_path(path)
  const active = client.get_active_connections().find((it) => it.get_connection()?.get_path() === path)
  if (!remote || !active) return
  await activation(active)

  const copy = NM.SimpleConnection.new_clone(remote)
  const vpn = copy.get_setting_vpn()!
  const owner = keep ? NM.SettingSecretFlags.NONE : NM.SettingSecretFlags.AGENT_OWNED
  if (!keep && keys.every((key) => secretFlags(vpn, key) === owner)) return
  for (const key of keys) vpn.add_data_item(`${key}-flags`, String(owner))
  // the update replaces the stored secrets with the ones it carries, so it carries every system-owned one
  for (const [key, value] of Object.entries(secrets)) {
    if (value && secretFlags(vpn, key) === NM.SettingSecretFlags.NONE) vpn.add_secret(key, value)
  }
  await remote.update2(copy.to_dbus(NM.ConnectionSerializationFlags.ALL), NM.SettingsUpdate2Flags.TO_DISK, null, null)
}

const rememberable = (vpn: VpnSetting, key: string) => {
  const flags = vpn.data?.[`${key}-flags`]
  return flags !== undefined && !(Number(flags) & (NM.SettingSecretFlags.NOT_SAVED | NM.SettingSecretFlags.NOT_REQUIRED))
}

// asks the profile's plugin for the secrets it needs; returns a function that withdraws the request
export function askVpnSecrets(
  { connection, path, hints, flags }: { connection: Record<string, Record<string, unknown>>; path: string; hints: string[]; flags: number },
  reply: (outcome: Outcome) => void,
): () => void {
  const vpn = (connection.vpn ?? {}) as VpnSetting
  const id = String(connection.connection?.id ?? "VPN")
  const service = vpn["service-type"] ?? ""
  const plugin = NM.VpnPluginInfo.list_find_by_service(NM.VpnPluginInfo.list_load(), service)
  const dialog = plugin?.get_auth_dialog()
  if (!plugin || !dialog) {
    console.error(`No auth dialog for the VPN [${id}, service: ${service}]`)
    reply({ canceled: false })
    return () => {}
  }

  const external = plugin.lookup_property("GNOME", "supports-external-ui-mode") === "true"
  const argv = [
    dialog,
    ...["-u", String(connection.connection?.uuid ?? ""), "-n", id, "-s", service],
    ...(external ? ["--external-ui-mode"] : []),
    ...(flags & allowInteraction ? ["-i"] : []),
    ...(flags & requestNew ? ["-r"] : []),
    ...(plugin.supports_hints() ? hints.flatMap((hint) => ["-t", hint]) : []),
  ]
  const cancellable = new Gio.Cancellable()
  const helper = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE)
  let closePrompt: (() => void) | null = null

  const ask = (stdout: string) => {
    if (!external) return reply(helper.get_successful() ? { secrets: parsePairs(stdout) } : { canceled: true })

    const { description, fields } = parseFields(stdout)
    const known = Object.fromEntries(fields.filter((it) => it.value).map((it) => [it.key, it.value]))
    const asked = fields.filter((it) => it.ask)
    if (asked.length === 0 || !(flags & allowInteraction)) return reply({ secrets: known })

    const keep = asked.filter((it) => rememberable(vpn, it.key)).map((it) => it.key)
    closePrompt = prompt({
      title: id,
      message: description,
      fields: asked.map(({ key, label, secret, value }) => ({ key, label, secret, value })),
      toggles: keep.length > 0 ? [{ key: "remember", label: "Remember", active: true }] : [],
      actions: [{ id: "connect", label: "Connect" }],
      reply: (answer) => {
        if (!answer) return reply({ canceled: true })
        const secrets = { ...known, ...answer.values }
        reply({ secrets })
        if (keep.length > 0) {
          remember(path, secrets, keep, answer.toggles.remember).catch((error: unknown) =>
            console.error(`Failed to update the stored VPN secrets [${id}]: ${error}`),
          )
        }
      },
    })
    if (!closePrompt) reply({ canceled: false })
  }

  helper
    .communicate_utf8_async(details(vpn), cancellable)
    .then(([stdout]) => ask(stdout ?? ""))
    .catch((error: unknown) => {
      if (!cancellable.is_cancelled()) console.error(`The VPN auth dialog failed [${id}, dialog: ${dialog}]: ${error}`)
      reply({ canceled: cancellable.is_cancelled() })
    })

  return () => {
    cancellable.cancel()
    helper.force_exit()
    closePrompt?.()
  }
}
