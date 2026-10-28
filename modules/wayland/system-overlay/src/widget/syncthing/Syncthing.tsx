import { Accessor, For, onCleanup } from "ags"
import GLib from "gi://GLib"
import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango"
import Panel from "../Panel"
import PanelButton from "../PanelButton"
import { closePanel, launch, open } from "../panels"
import { status, SyncFolder, SyncStatus } from "./state"

const items = (count: number) => `${count.toLocaleString()} ${count === 1 ? "item" : "items"}`

const left = (folder: SyncFolder) =>
  folder.items > 0 ? `${items(folder.items)}, ${GLib.format_size(folder.bytes)} left` : "Preparing"

function summary({ waiting, catchingUp, syncing }: SyncStatus) {
  return [
    ...waiting.map((it) => `Waiting for ${it.name}`),
    ...catchingUp.map((it) => `Catching up with ${it.name}`),
    ...syncing.map((it) => (it.items > 0 ? `Syncing ${it.label}: ${items(it.items)} left` : `Syncing ${it.label}`)),
  ].join("\n")
}

const active = status.as(({ waiting, catchingUp, syncing }) => waiting.length + catchingUp.length + syncing.length > 0)

type Entry = { title: string; detail: string }

function Row({ title, detail }: Entry) {
  return (
    <box cssClasses={["activity"]} orientation={Gtk.Orientation.VERTICAL}>
      <label label={title} xalign={0} ellipsize={Pango.EllipsizeMode.END} maxWidthChars={28} />
      <label cssClasses={["value"]} label={detail} xalign={0} />
    </box>
  )
}

function Section({ title, entries }: { title: string; entries: Accessor<Entry[]> }) {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={4} visible={entries.as((it) => it.length > 0)}>
      <label cssClasses={["group-title"]} label={title} xalign={0} />
      <For each={entries}>{(entry) => <Row {...entry} />}</For>
    </box>
  )
}

function SyncthingPanel({ address }: { address: string }) {
  return (
    <Panel title="Syncthing" footer={[{ label: "Open Syncthing", onClicked: () => launch("xdg-open", address) }]}>
      <box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
        <Section
          title="Waiting for"
          entries={status.as((it) => it.waiting.map((device) => ({ title: device.name, detail: "Not reconnected since the wake" })))}
        />
        <Section
          title="Catching up with"
          entries={status.as((it) => it.catchingUp.map((device) => ({ title: device.name, detail: "Exchanging file lists" })))}
        />
        <Section
          title="Syncing"
          entries={status.as((it) => it.syncing.map((folder) => ({ title: folder.label, detail: left(folder) })))}
        />
      </box>
    </Panel>
  )
}

export default function Syncthing({ address }: { address: string }) {
  return (
    <box visible={active}>
      <PanelButton
        cssClasses={["syncthing"]}
        tooltip={status.as(summary)}
        panel={() => <SyncthingPanel address={address} />}
        onSetup={(button) => {
          // the panel would otherwise stay open under a hidden button once syncing ends
          const unsubscribe = active.subscribe(() => {
            if (!active.get() && open.get()?.anchor === button) closePanel()
          })
          onCleanup(unsubscribe)
        }}
      >
        <image iconName="emblem-synchronizing-symbolic" />
      </PanelButton>
    </box>
  )
}
