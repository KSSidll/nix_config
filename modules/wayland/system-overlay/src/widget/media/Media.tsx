import { createBinding, createComputed, For } from "ags"
import Gtk from "gi://Gtk?version=4.0"
import Pango from "gi://Pango"
import AstalMpris from "gi://AstalMpris"
import Panel from "../Panel"
import PanelButton from "../PanelButton"
import { closePanel, open } from "../panels"
import { current, focusPlayer, players, playing } from "./state"

const { PLAYING } = AstalMpris.PlaybackStatus

const time = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`
}

function PlayerCard({ player }: { player: AstalMpris.Player }) {
  const coverArt = createBinding(player, "coverArt")
  const artist = createBinding(player, "artist")
  const position = createBinding(player, "position")
  const length = createBinding(player, "length")
  const isPlaying = createBinding(player, "playbackStatus").as((it) => it === PLAYING)
  const seekable = createComputed(() => createBinding(player, "canSeek")() && length() > 0)

  return (
    <box cssClasses={["player"]} orientation={Gtk.Orientation.VERTICAL} spacing={6}>
      <button
        cssClasses={["row", "player-info"]}
        tooltipText={`Open ${player.identity}`}
        onClicked={() => {
          closePanel()
          focusPlayer(player)
        }}
      >
        <box spacing={10}>
          <box cssClasses={["cover"]} overflow={Gtk.Overflow.HIDDEN} valign={Gtk.Align.CENTER}>
            <image file={coverArt} pixelSize={48} visible={coverArt.as(Boolean)} />
            <image cssClasses={["placeholder"]} iconName="audio-x-generic-symbolic" pixelSize={24} visible={coverArt.as((it) => !it)} />
          </box>
          <box orientation={Gtk.Orientation.VERTICAL} valign={Gtk.Align.CENTER} hexpand>
            <label
              label={createBinding(player, "title").as((it) => it || player.identity)}
              xalign={0}
              ellipsize={Pango.EllipsizeMode.END}
              maxWidthChars={1}
            />
            <label
              cssClasses={["value"]}
              label={artist.as((it) => (it ? `${it} · ${player.identity}` : player.identity))}
              xalign={0}
              ellipsize={Pango.EllipsizeMode.END}
              maxWidthChars={1}
            />
          </box>
        </box>
      </button>
      <box cssClasses={["slider-row"]} spacing={8} visible={seekable}>
        <label cssClasses={["value"]} label={position.as(time)} widthChars={5} xalign={0} />
        <slider hexpand min={0} max={length} value={position} onChangeValue={(_, __, value) => player.set_position(value)} />
        <label cssClasses={["value"]} label={length.as(time)} widthChars={5} xalign={1} />
      </box>
      <box halign={Gtk.Align.CENTER} spacing={16}>
        <button
          cssClasses={["icon-button"]}
          tooltipText="Previous"
          sensitive={createBinding(player, "canGoPrevious")}
          onClicked={() => player.previous()}
        >
          <image iconName="media-skip-backward-symbolic" />
        </button>
        <button
          cssClasses={["icon-button"]}
          tooltipText={isPlaying.as((it) => (it ? "Pause" : "Play"))}
          onClicked={() => player.play_pause()}
        >
          <image iconName={isPlaying.as((it) => (it ? "media-playback-pause-symbolic" : "media-playback-start-symbolic"))} />
        </button>
        <button
          cssClasses={["icon-button"]}
          tooltipText="Next"
          sensitive={createBinding(player, "canGoNext")}
          onClicked={() => player.next()}
        >
          <image iconName="media-skip-forward-symbolic" />
        </button>
      </box>
    </box>
  )
}

function MediaPanel() {
  const ordered = createComputed(() => {
    const first = current()
    return first ? [first, ...players().filter((it) => it !== first)] : players()
  })

  return (
    <Panel title="Now playing">
      <box cssClasses={["players"]} orientation={Gtk.Orientation.VERTICAL} spacing={12} widthRequest={320}>
        <For each={ordered}>{(player) => <PlayerCard player={player} />}</For>
      </box>
    </Panel>
  )
}

// shown while something plays, and while its own panel is open so pausing from the panel doesn't take it away
export default function Media() {
  let button: Gtk.Button | null = null
  const visible = createComputed(() => playing() || open()?.anchor === button)

  return (
    <box visible={visible}>
      <PanelButton panel={MediaPanel} onSetup={(self) => (button = self)}>
        <image iconName="audio-x-generic-symbolic" />
      </PanelButton>
    </box>
  )
}
