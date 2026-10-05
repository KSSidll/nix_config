import { createComputed } from "ags"
import Gtk from "gi://Gtk?version=4.0"
import { elapsed, formatElapsed, recording, screenshot, startRecording, stopRecording } from "../capture"
import Panel from "../Panel"
import Tile from "./Tile"

export function ScreenshotTile({ onDetails }: { onDetails: () => void }) {
  return (
    <Tile
      icon="camera-photo-symbolic"
      title="Screenshot"
      subtitle="Select an area"
      onToggle={() => screenshot("select")}
      onDetails={onDetails}
    />
  )
}

export function RecordTile({ onDetails }: { onDetails: () => void }) {
  const active = recording.as((it) => it !== null)
  return (
    <Tile
      icon="media-record-symbolic"
      title="Record"
      subtitle={createComputed(() => (active() ? formatElapsed(elapsed()) : "Screen"))}
      active={active}
      onToggle={() => (recording.get() ? stopRecording() : startRecording("screen"))}
      onDetails={onDetails}
    />
  )
}

function Row({ icon, label, onClicked }: { icon: string; label: string; onClicked: () => void }) {
  return (
    <button cssClasses={["row"]} onClicked={onClicked}>
      <box spacing={8}>
        <image iconName={icon} />
        <label label={label} hexpand xalign={0} />
      </box>
    </button>
  )
}

export function CapturePage({ onBack }: { onBack: () => void }) {
  const idle = recording.as((it) => it === null)
  return (
    <Panel title="Capture" onBack={onBack}>
      <box orientation={Gtk.Orientation.VERTICAL}>
        <label cssClasses={["group-title"]} label="Screenshot" xalign={0} />
        <Row icon="camera-photo-symbolic" label="Select an area" onClicked={() => screenshot("select")} />
        <Row icon="video-display-symbolic" label="Whole screen" onClicked={() => screenshot("screen")} />
        <Row icon="window-new-symbolic" label="Select a window" onClicked={() => screenshot("window")} />
        <label cssClasses={["group-title"]} label="Recording" xalign={0} />
        <box orientation={Gtk.Orientation.VERTICAL} visible={idle}>
          <Row icon="video-display-symbolic" label="Record the screen" onClicked={() => startRecording("screen")} />
          <Row icon="edit-select-all-symbolic" label="Record an area" onClicked={() => startRecording("region")} />
        </box>
        <box visible={idle.as((it) => !it)}>
          <Row icon="media-playback-stop-symbolic" label="Stop recording" onClicked={stopRecording} />
        </box>
      </box>
    </Panel>
  )
}
