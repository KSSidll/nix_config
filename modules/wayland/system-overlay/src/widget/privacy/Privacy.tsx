import { Accessor, createComputed, For, onCleanup } from "ags"
import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango"
import Panel from "../Panel"
import PanelButton from "../PanelButton"
import { closePanel, open } from "../panels"
import { Activity } from "./activity"
import { cameraUsers } from "./camera"
import { microphoneUsers } from "./microphone"
import { screenRecordings, screenShares } from "./screen"

const sources = [
  { title: "Recording", icon: "media-record-symbolic", device: "Recording", activities: screenRecordings },
  { title: "Screen sharing", icon: "screen-shared-symbolic", device: "Screen", activities: screenShares },
  { title: "Camera", icon: "camera-web-symbolic", device: "Camera", activities: cameraUsers },
  { title: "Microphone", icon: "audio-input-microphone-symbolic", device: "Microphone", activities: microphoneUsers },
]

const usedBy = (device: string) => (all: Activity[]) => `${device}: ${[...new Set(all.map((it) => it.app))].join(", ")}`

function ActivityRow({ activity }: { activity: Activity }) {
  return (
    <box cssClasses={["activity"]} spacing={8}>
      <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand>
        <label label={activity.app} xalign={0} ellipsize={Pango.EllipsizeMode.END} maxWidthChars={28} />
        {activity.target && (
          <label cssClasses={["value"]} label={activity.target} xalign={0} ellipsize={Pango.EllipsizeMode.END} maxWidthChars={28} />
        )}
      </box>
      {activity.action && (
        <button cssClasses={["text-button"]} valign={Gtk.Align.CENTER} onClicked={activity.action.run}>
          <label label={activity.action.label} />
        </button>
      )}
    </box>
  )
}

function Section({ title, activities }: { title: string; activities: Accessor<Activity[]> }) {
  return (
    <box orientation={Gtk.Orientation.VERTICAL} spacing={4} visible={activities.as((it) => it.length > 0)}>
      <label cssClasses={["group-title"]} label={title} xalign={0} />
      <For each={activities}>{(activity) => <ActivityRow activity={activity} />}</For>
    </box>
  )
}

function PrivacyPanel() {
  return (
    <Panel title="Privacy">
      <box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
        {sources.map((source) => <Section {...source} />)}
      </box>
    </Panel>
  )
}

export default function Privacy() {
  const active = createComputed(() => sources.some((source) => source.activities().length > 0))

  return (
    <box visible={active}>
      <PanelButton
        cssClasses={["privacy"]}
        panel={PrivacyPanel}
        onSetup={(button) => {
          // the panel would otherwise stay open under a hidden button once the last activity ends
          const unsubscribe = active.subscribe(() => {
            if (!active.get() && open.get()?.anchor === button) closePanel()
          })
          onCleanup(unsubscribe)
        }}
      >
        <box spacing={8}>
          {sources.map(({ icon, device, activities }) => (
            <image
              iconName={icon}
              visible={activities.as((it) => it.length > 0)}
              tooltipText={activities.as(usedBy(device))}
            />
          ))}
        </box>
      </PanelButton>
    </box>
  )
}
