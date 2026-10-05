import { onCleanup } from "ags"
import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango"
import Astal from "gi://Astal?version=4.0"
import Panel from "../Panel"
import { closePanel, openPanel } from "../panels"
import { focusedOutput } from "../niri"

export type Field = { key: string; label: string; secret: boolean; value?: string }

export type Toggle = { key: string; label: string; active: boolean }

export type PromptRequest = {
  title: string
  message: string
  // a code to compare or type elsewhere, shown large
  code?: string
  fields?: Field[]
  toggles?: Toggle[]
  // the answers, one button each; Enter in a field picks the first. Without any the prompt only informs
  actions?: { id: string; label: string }[]
  // the output whose bar shows the prompt, instead of the focused one
  output?: string
  // runs exactly once: with the chosen action and the entered values, or with null when the prompt closes without one
  reply?: (answer: Answer | null) => void
}

export type Answer = { action: string; values: Record<string, string>; toggles: Record<string, boolean> }

const statusButtons = new Set<Gtk.Widget>()

// prompts belong to the focused monitor's status button, like its own panel
export function registerPromptAnchor(button: Gtk.Widget) {
  statusButtons.add(button)
  onCleanup(() => statusButtons.delete(button))
}

function promptAnchor(output = focusedOutput.get()) {
  const buttons = [...statusButtons]
  return buttons.find((it) => (it.get_root() as Astal.Window | null)?.gdkmonitor.connector === output) ?? buttons[0]
}

type Entry = { request: PromptRequest; reply: (answer: Answer | null) => void }

// requests arrive in bursts (a pairing, then the services the device asks for), so each waits for the one before it
const queue: Entry[] = []
let showing: Entry | null = null

function Prompt({ entry }: { entry: Entry }) {
  const { request } = entry
  const entries = new Map<string, Gtk.Editable>()
  const switches = new Map<string, Gtk.Switch>()
  const fields = request.fields ?? []
  const focused = Math.max(0, fields.findIndex((it) => !it.value))

  const actions = request.actions ?? []
  const choose = (action: string) => {
    entry.reply({
      action,
      values: Object.fromEntries([...entries].map(([key, editable]) => [key, editable.text])),
      toggles: Object.fromEntries([...switches].map(([key, toggle]) => [key, toggle.active])),
    })
    closePanel()
  }
  const submit = () => actions[0] && choose(actions[0].id)
  // closing the panel any other way (Escape, a click outside, another panel opening) cancels the request
  onCleanup(() => entry.reply(null))

  const register = (field: Field, index: number) => (self: Gtk.Editable) => {
    entries.set(field.key, self)
    self.text = field.value ?? ""
    if (index === focused) self.connect("map", () => self.grab_focus())
  }

  return (
    <Panel title={request.title} footer={actions.map((it) => ({ label: it.label, onClicked: () => choose(it.id) }))}>
      <box orientation={Gtk.Orientation.VERTICAL} spacing={8} widthRequest={300}>
        <label
          cssClasses={["value"]}
          xalign={0}
          wrap
          wrapMode={Pango.WrapMode.WORD_CHAR}
          maxWidthChars={1}
          label={request.message}
        />
        {request.code && <label cssClasses={["code"]} label={request.code} selectable />}
        {fields.map((field, index) =>
          field.secret ? (
            <Gtk.PasswordEntry
              cssClasses={["password"]}
              placeholderText={field.label}
              showPeekIcon
              onActivate={submit}
              $={register(field, index)}
            />
          ) : (
            <entry cssClasses={["password"]} placeholderText={field.label} onActivate={submit} $={register(field, index)} />
          ),
        )}
        {(request.toggles ?? []).map((toggle) => (
          <box cssClasses={["setting"]}>
            <label label={toggle.label} hexpand xalign={0} />
            <switch valign={Gtk.Align.CENTER} active={toggle.active} $={(self) => switches.set(toggle.key, self)} />
          </box>
        ))}
      </box>
    </Panel>
  )
}

function showNext() {
  const next = queue[0]
  if (!next) return
  const anchor = promptAnchor(next.request.output)
  if (!anchor) {
    for (const entry of queue.splice(0)) entry.reply(null)
    return
  }
  queue.shift()
  showing = next
  openPanel(anchor, () => <Prompt entry={next} />, { modal: true })
}

// queues the prompt; returns a function that withdraws it, closing it if it is on screen, or null when no bar is there
// to show it
export function prompt(request: PromptRequest): (() => void) | null {
  if (!promptAnchor()) return null

  let open = true
  const entry: Entry = {
    request,
    reply: (answer) => {
      if (!open) return
      open = false
      request.reply?.(answer)
      if (showing !== entry) return
      showing = null
      // the reply comes from the panel being torn down, which mustn't open the next one from inside itself
      GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        if (!showing) showNext()
        return GLib.SOURCE_REMOVE
      })
    },
  }
  queue.push(entry)
  if (!showing) showNext()

  return () => {
    if (!open) return
    if (showing === entry) return closePanel()
    queue.splice(queue.indexOf(entry), 1)
    entry.reply(null)
  }
}
