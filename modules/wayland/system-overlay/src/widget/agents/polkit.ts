import Gio from "gi://Gio"
import GLib from "gi://GLib"
import Polkit from "gi://Polkit"
import PolkitAgent from "gi://PolkitAgent"
import { callSystem, serveAgent } from "./dbus"
import { prompt } from "./prompt"

const agentInterface = `
<node>
  <interface name="org.freedesktop.PolicyKit1.AuthenticationAgent">
    <method name="BeginAuthentication">
      <arg name="action_id" type="s" direction="in"/>
      <arg name="message" type="s" direction="in"/>
      <arg name="icon_name" type="s" direction="in"/>
      <arg name="details" type="a{ss}" direction="in"/>
      <arg name="cookie" type="s" direction="in"/>
      <arg name="identities" type="a(sa{sv})" direction="in"/>
    </method>
    <method name="CancelAuthentication">
      <arg name="cookie" type="s" direction="in"/>
    </method>
  </interface>
</node>`

const errorPrefix = "org.freedesktop.PolicyKit1.Error"
const path = "/org/freedesktop/PolicyKit1/AuthenticationAgent"

type Request = { session: PolkitAgent.Session; close: (() => void) | null; cancelled: boolean }

const pending = new Map<string, Request>()

// polkit lists everyone allowed to authorize the action, which includes the user when they are an administrator
function identityFor(identities: [string, Record<string, GLib.Variant>][]) {
  const users = identities
    .filter(([kind]) => kind === "unix-user")
    .map(([, it]) => new Polkit.UnixUser({ uid: it.uid.unpack() as number }))
  return users.find((it) => it.get_name() === GLib.get_user_name()) ?? users[0] ?? null
}

const quote = (arg: string) => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : GLib.shell_quote(arg))

// pkexec shortens long commands in its message, but polkit names the waiting pkexec process, whose arguments are the
// command it runs. Any process can ask for pkexec's action, so only one running as root is believed.
function pkexecCommand(pid: string | undefined) {
  if (!pid) return null
  try {
    const read = (file: string) => new TextDecoder().decode(GLib.file_get_contents(`/proc/${pid}/${file}`)[1])
    const effectiveUid = read("status").match(/^Uid:\s+\d+\s+(\d+)/m)?.[1]
    if (effectiveUid !== "0") return null
    return read("cmdline").split("\0").slice(1, -1).map(quote).join(" ")
  } catch {
    return null
  }
}

// The password goes to polkit's helper, which checks it and reports the result to polkit itself; this agent only
// learns whether it worked.
function authenticate(cookie: string, message: string, user: Polkit.UnixUser, invocation: Gio.DBusMethodInvocation, notice?: string) {
  const session = PolkitAgent.Session.new(user, cookie)
  const request: Request = { session, close: null, cancelled: false }
  pending.set(cookie, request)
  let answered = false

  const other = user.get_name() === GLib.get_user_name() ? null : `Enter the password of ${user.get_name()}.`
  session.connect("show-error", (_, text: string) => (notice = text))
  session.connect("show-info", (_, text: string) => (notice = text))
  session.connect("request", (_, question: string, echo: boolean) => {
    request.close = prompt({
      title: "Authentication required",
      message: [message, other, notice].filter(Boolean).join("\n\n"),
      fields: [{ key: "response", label: question.replace(/:\s*$/, ""), secret: !echo }],
      actions: [{ id: "authenticate", label: "Authenticate" }],
      reply: (answer) => {
        request.close = null
        if (answer) {
          answered = true
          session.response(answer.values.response)
        } else {
          request.cancelled = true
          session.cancel()
        }
      },
    })
    notice = undefined
    if (!request.close) {
      request.cancelled = true
      session.cancel()
    }
  })
  session.connect("completed", (_, authorized: boolean) => {
    pending.delete(cookie)
    if (authorized) invocation.return_value(null)
    else if (request.cancelled) invocation.return_dbus_error(`${errorPrefix}.Cancelled`, "canceled")
    // without an answer the helper itself failed, and asking again would fail the same way
    else if (answered) authenticate(cookie, message, user, invocation, "Authentication failed. Try again.")
    else invocation.return_dbus_error(`${errorPrefix}.Failed`, `the authentication helper failed [cookie: ${cookie}]`)
  })
  session.initiate()
}

const agent = {
  // GJS unpacks the arguments one level, so the {sv} values arrive as variants
  BeginAuthenticationAsync(
    [actionId, message, , details, cookie, identities]: [string, string, string, Record<string, string>, string, [string, Record<string, GLib.Variant>][]],
    invocation: Gio.DBusMethodInvocation,
  ) {
    const user = identityFor(identities)
    if (!user) {
      invocation.return_dbus_error(`${errorPrefix}.Failed`, `no user to authenticate as [action: ${actionId}]`)
      return
    }
    const command = actionId === "org.freedesktop.policykit.exec" ? pkexecCommand(details["polkit.caller-pid"]) : null
    authenticate(cookie, command ? `${message}\n\nFull command:\n${command}` : message, user, invocation)
  },

  // the requesting process went away or polkit gave up on the request
  CancelAuthentication(cookie: string) {
    const request = pending.get(cookie)
    if (!request) return
    request.cancelled = true
    if (request.close) request.close()
    else request.session.cancel()
  },
}

export function startPolkitAgent() {
  serveAgent({
    description: "polkit authentication agent",
    service: "org.freedesktop.PolicyKit1",
    path,
    xml: agentInterface,
    implementation: agent,
    register: async () => {
      // the overlay runs as a user service outside the login session, which logind's "auto" resolves to anyway
      const [id] = (
        await callSystem(
          "org.freedesktop.login1",
          "/org/freedesktop/login1/session/auto",
          "org.freedesktop.DBus.Properties",
          "Get",
          new GLib.Variant("(ss)", ["org.freedesktop.login1.Session", "Id"]),
        )
      ).recursiveUnpack() as [string]
      return callSystem(
        "org.freedesktop.PolicyKit1",
        "/org/freedesktop/PolicyKit1/Authority",
        "org.freedesktop.PolicyKit1.Authority",
        "RegisterAuthenticationAgent",
        new GLib.Variant("((sa{sv})ss)", [["unix-session", { "session-id": GLib.Variant.new_string(id) }], GLib.getenv("LANG") ?? "C", path]),
      )
    },
  })
}
