import { createBinding, For, With } from "ags"
import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango"
import AstalWp from "gi://AstalWp"
import Panel from "../Panel"
import { launch } from "../panels"
import { audio, toggleMute } from "../controls"
import Tile from "./Tile"

// a step is 1%; a wheel notch moves 5%
export const volumeScroll = { perNotch: 5, pixelsPerStep: 16 }

// renders against the current default device, rebuilding when it changes
export function WithDefault({
  device,
  children,
}: {
  device: "defaultSpeaker" | "defaultMicrophone"
  children: (endpoint: AstalWp.Endpoint) => JSX.Element
}) {
  return <With value={createBinding(audio, device)}>{(endpoint: AstalWp.Endpoint) => children(endpoint)}</With>
}

export function VolumeSlider({ onDetails }: { onDetails: () => void }) {
  return (
    <WithDefault device="defaultSpeaker">
      {(speaker) => (
        <box cssClasses={["slider-row"]} spacing={8}>
          <button cssClasses={["icon-button"]} tooltipText="Mute" onClicked={() => toggleMute(speaker)}>
            <image iconName={createBinding(speaker, "volumeIcon")} />
          </button>
          <slider hexpand value={createBinding(speaker, "volume")} onChangeValue={(_, __, value) => speaker.set_volume(value)} />
          <label cssClasses={["value"]} label={createBinding(speaker, "volume").as((it) => `${Math.round(it * 100)}%`)} widthChars={4} xalign={1} />
          <button cssClasses={["icon-button"]} tooltipText="Output devices" onClicked={onDetails}>
            <image iconName="go-next-symbolic" />
          </button>
        </box>
      )}
    </WithDefault>
  )
}

export function MicrophoneTile() {
  return (
    <WithDefault device="defaultMicrophone">
      {(microphone) => (
        <Tile
          icon={createBinding(microphone, "mute").as((it) => (it ? "microphone-disabled-symbolic" : "audio-input-microphone-symbolic"))}
          title="Microphone"
          subtitle={createBinding(microphone, "mute").as((it) => (it ? "Muted" : "On"))}
          active={createBinding(microphone, "mute").as((it) => !it)}
          onToggle={() => toggleMute(microphone)}
        />
      )}
    </WithDefault>
  )
}

export function OutputPage({ onBack }: { onBack: () => void }) {
  const speakers = createBinding(audio, "speakers").as((it) => it ?? [])

  return (
    <Panel title="Output" onBack={onBack} footer={[{ label: "Mixer…", onClicked: () => launch("pavucontrol") }]}>
      <box orientation={Gtk.Orientation.VERTICAL}>
        <For each={speakers}>
          {(speaker) => (
            <button
              cssClasses={createBinding(speaker, "isDefault").as((it) => (it ? ["row", "selected"] : ["row"]))}
              onClicked={() => speaker.set_is_default(true)}
            >
              <label label={createBinding(speaker, "description").as((it) => it ?? "")} xalign={0} ellipsize={Pango.EllipsizeMode.END} maxWidthChars={30} />
            </button>
          )}
        </For>
      </box>
    </Panel>
  )
}
