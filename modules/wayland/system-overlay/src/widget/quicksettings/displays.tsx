import { For } from "ags"
import Gtk from "gi://Gtk?version=4.0"
import { currentMode, DisplayMode, displayName, externals, modeLabels, setDisplayMode } from "../displays"
import { Output } from "../niri"
import Panel from "../Panel"
import Tile from "./Tile"

export const hasExternals = () => externals.get().length > 0

export function DisplaysTile({ onDetails }: { onDetails: () => void }) {
  const subtitle = externals.as((all) => (all.length === 1 ? displayName(all[0]) : `${all.length} displays`))
  return <Tile icon="video-display-symbolic" title="Displays" subtitle={subtitle} onToggle={onDetails} onDetails={onDetails} />
}

function DisplayRows({ output }: { output: Output }) {
  const mode = currentMode(output)
  return (
    <box orientation={Gtk.Orientation.VERTICAL}>
      <label cssClasses={["group-title"]} label={displayName(output)} xalign={0} />
      {(["extend", "mirror", "off"] as DisplayMode[]).map((option) => (
        <button
          cssClasses={mode.as((it) => (it === option ? ["row", "selected"] : ["row"]))}
          onClicked={() => mode.get() !== option && setDisplayMode(output, option)}
        >
          <label label={modeLabels[option]} xalign={0} />
        </button>
      ))}
    </box>
  )
}

export function DisplaysPage({ onBack }: { onBack: () => void }) {
  return (
    <Panel title="Displays" onBack={onBack}>
      <box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
        <For each={externals}>{(output: Output) => <DisplayRows output={output} />}</For>
      </box>
    </Panel>
  )
}
