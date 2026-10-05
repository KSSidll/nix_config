import Gio from "gi://Gio"
import GLib from "gi://GLib"
import AstalBluetooth from "gi://AstalBluetooth"
import { addressOf } from "../bluez"
import { callSystem, serveAgent } from "./dbus"
import { prompt, PromptRequest } from "./prompt"

// bluez asks the agent of whoever started a pairing (the overlay's own Pair calls) and the default agent for pairings
// a device starts, so this one registers as both

const agentInterface = `
<node>
  <interface name="org.bluez.Agent1">
    <method name="Release"/>
    <method name="RequestPinCode">
      <arg name="device" type="o" direction="in"/>
      <arg name="pincode" type="s" direction="out"/>
    </method>
    <method name="DisplayPinCode">
      <arg name="device" type="o" direction="in"/>
      <arg name="pincode" type="s" direction="in"/>
    </method>
    <method name="RequestPasskey">
      <arg name="device" type="o" direction="in"/>
      <arg name="passkey" type="u" direction="out"/>
    </method>
    <method name="DisplayPasskey">
      <arg name="device" type="o" direction="in"/>
      <arg name="passkey" type="u" direction="in"/>
      <arg name="entered" type="q" direction="in"/>
    </method>
    <method name="RequestConfirmation">
      <arg name="device" type="o" direction="in"/>
      <arg name="passkey" type="u" direction="in"/>
    </method>
    <method name="RequestAuthorization">
      <arg name="device" type="o" direction="in"/>
    </method>
    <method name="AuthorizeService">
      <arg name="device" type="o" direction="in"/>
      <arg name="uuid" type="s" direction="in"/>
    </method>
    <method name="Cancel"/>
  </interface>
</node>`

const agentPath = "/io/astal/SystemOverlay/BluetoothAgent"
const bluetooth = AstalBluetooth.get_default()

// the profiles devices ask for, by their 16-bit id in the Bluetooth base UUID 0000xxxx-0000-1000-8000-00805f9b34fb
const services: Record<string, string> = {
  "1101": "a serial port",
  "1103": "dial-up networking",
  "1105": "file transfer",
  "1106": "file transfer",
  "1108": "headset audio",
  "110a": "audio output",
  "110b": "audio input",
  "110c": "media controls",
  "110d": "audio streaming",
  "110e": "media controls",
  "110f": "media controls",
  "1112": "headset audio",
  "1115": "network sharing",
  "1116": "network sharing",
  "111e": "hands-free calls",
  "111f": "hands-free calls",
  "1124": "keyboard and mouse input",
  "112f": "the phonebook",
  "1132": "messages",
  "1200": "device information",
  "1812": "keyboard and mouse input",
}

function serviceName(uuid: string) {
  const match = uuid.toLowerCase().match(/^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/)
  return (match && services[match[1]]) ?? `a service (${uuid})`
}

function deviceAt(path: string) {
  const address = addressOf(path)
  return { address, device: bluetooth.devices.find((it) => it.address === address) ?? null }
}

const passkeyText = (passkey: number) => String(passkey).padStart(6, "0")

// the prompt for bluez's request awaiting an answer, which Cancel withdraws when bluez gives up on it
let current: (() => void) | null = null
// service requests waiting on an answer, per device path, which trusting the device answers
const authorizations = new Map<string, Set<{ allowed: boolean; close: () => void }>>()

function show(path: string, request: Omit<PromptRequest, "title">) {
  const { address, device } = deviceAt(path)
  return prompt({ ...request, title: device?.alias ?? address })
}

// prompts for an answer, then replies through answer, with Rejected when declined, or with Canceled when the prompt
// closes without an answer
function ask(
  path: string,
  invocation: Gio.DBusMethodInvocation,
  request: Omit<PromptRequest, "title" | "reply" | "actions"> & { accept: string; decline?: string },
  answer: (values: Record<string, string>) => GLib.Variant | null | undefined,
) {
  const { accept, decline, ...shown } = request
  const close = show(path, {
    ...shown,
    actions: [{ id: "accept", label: accept }, ...(decline ? [{ id: "decline", label: decline }] : [])],
    reply: (chosen) => {
      if (current === close) current = null
      if (!chosen) {
        invocation.return_dbus_error("org.bluez.Error.Canceled", "canceled")
        return
      }
      if (chosen.action === "decline") {
        invocation.return_dbus_error("org.bluez.Error.Rejected", "declined")
        return
      }
      const reply = answer(chosen.values)
      if (reply === undefined) invocation.return_dbus_error("org.bluez.Error.Rejected", "invalid answer")
      else invocation.return_value(reply)
    },
  })
  if (!close) invocation.return_dbus_error("org.bluez.Error.Rejected", "no bar to prompt on")
  current = close
}

// shows a code to type on the device; bluez doesn't wait for this, and it closes once the device is paired
function display(path: string, message: string, code: string) {
  const { device } = deviceAt(path)
  const paired = device?.connect("notify::paired", () => device.paired && close?.())
  const close = show(path, {
    message,
    code,
    reply: () => {
      if (current === close) current = null
      if (paired !== undefined) device!.disconnect(paired)
    },
  })
  if (!close && paired !== undefined) device!.disconnect(paired)
  current = close
}

function askTrust(device: AstalBluetooth.Device) {
  prompt({
    title: device.alias,
    message: "Trusted devices connect and use services without asking.",
    actions: [
      { id: "trust", label: "Trust" },
      { id: "distrust", label: "Don't trust" },
    ],
    reply: (answer) => {
      if (answer?.action !== "trust") return
      device.trusted = true
      for (const [path, waiting] of authorizations) {
        if (addressOf(path) !== device.address) continue
        for (const entry of [...waiting]) {
          entry.allowed = true
          entry.close()
        }
      }
    },
  })
}

// a pairing either way, from the bar or from the device, ends with the question whether to trust it
function watchPairing(device: AstalBluetooth.Device) {
  device.connect("notify::paired", () => device.paired && !device.trusted && askTrust(device))
}

const agent = {
  Release() {},

  RequestPinCodeAsync([path]: [string], invocation: Gio.DBusMethodInvocation) {
    ask(
      path,
      invocation,
      { message: "Enter the device's PIN code.", fields: [{ key: "pin", label: "PIN", secret: false }], accept: "Pair" },
      ({ pin }) => (/^[\x20-\x7e]{1,16}$/.test(pin) ? new GLib.Variant("(s)", [pin]) : undefined),
    )
  },

  RequestPasskeyAsync([path]: [string], invocation: Gio.DBusMethodInvocation) {
    ask(
      path,
      invocation,
      { message: "Enter the passkey the device shows.", fields: [{ key: "passkey", label: "Passkey", secret: false }], accept: "Pair" },
      ({ passkey }) => (/^\d{1,6}$/.test(passkey) ? new GLib.Variant("(u)", [Number(passkey)]) : undefined),
    )
  },

  RequestConfirmationAsync([path, passkey]: [string, number], invocation: Gio.DBusMethodInvocation) {
    ask(
      path,
      invocation,
      { message: "Check that the device shows the same code.", code: passkeyText(passkey), accept: "Pair", decline: "Don't pair" },
      () => null,
    )
  },

  RequestAuthorizationAsync([path]: [string], invocation: Gio.DBusMethodInvocation) {
    ask(path, invocation, { message: "This device wants to pair.", accept: "Pair", decline: "Don't pair" }, () => null)
  },

  AuthorizeServiceAsync([path, uuid]: [string, string], invocation: Gio.DBusMethodInvocation) {
    const waiting = authorizations.get(path) ?? new Set()
    authorizations.set(path, waiting)
    const entry = { allowed: false, close: () => {} }
    const close = show(path, {
      message: `This device wants to use ${serviceName(uuid)}.`,
      actions: [
        { id: "allow", label: "Allow" },
        { id: "deny", label: "Don't allow" },
      ],
      reply: (answer) => {
        if (current === close) current = null
        waiting.delete(entry)
        if (waiting.size === 0) authorizations.delete(path)
        if (answer?.action === "allow" || entry.allowed) invocation.return_value(null)
        else invocation.return_dbus_error("org.bluez.Error.Rejected", "not allowed")
      },
    })
    if (!close) {
      if (waiting.size === 0) authorizations.delete(path)
      invocation.return_dbus_error("org.bluez.Error.Rejected", "no bar to prompt on")
      return
    }
    entry.close = close
    waiting.add(entry)
    current = close
  },

  DisplayPinCode(path: string, pin: string) {
    display(path, "Type this PIN on the device.", pin)
  },

  // repeats as digits are typed on the device, each call replacing the last
  DisplayPasskey(path: string, passkey: number, entered: number) {
    current?.()
    display(path, entered > 0 ? `Type this passkey on the device: ${entered} of 6 digits typed.` : "Type this passkey on the device.", passkeyText(passkey))
  },

  // bluez gave up on the request (timeout, or the pairing failed or was canceled)
  Cancel() {
    current?.()
  },
}

export function startBluetoothAgent() {
  bluetooth.devices.forEach(watchPairing)
  bluetooth.connect("device-added", (_, device) => watchPairing(device))

  serveAgent({
    description: "Bluetooth pairing agent",
    service: "org.bluez",
    path: agentPath,
    xml: agentInterface,
    implementation: agent,
    register: async () => {
      await callSystem("org.bluez", "/org/bluez", "org.bluez.AgentManager1", "RegisterAgent", new GLib.Variant("(os)", [agentPath, "KeyboardDisplay"]))
      await callSystem("org.bluez", "/org/bluez", "org.bluez.AgentManager1", "RequestDefaultAgent", new GLib.Variant("(o)", [agentPath]))
    },
  })
}
