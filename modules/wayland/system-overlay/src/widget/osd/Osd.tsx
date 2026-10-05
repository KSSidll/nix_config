import app from "ags/gtk4/app"
import { Accessor, createBinding, createComputed, onCleanup, With } from "ags"
import Gdk from "gi://Gdk?version=4.0"
import Astal from "gi://Astal?version=4.0"
import AstalMpris from "gi://AstalMpris"
import Pango from "gi://Pango"
import { brightness } from "../controls"
import { WithDefault } from "../quicksettings/audio"
import { OsdKind, shown } from "./state"
import { focusedOutput } from "../niri"
import { current } from "../media/state"

function Level({ icon, level, label }: { icon: string | Accessor<string>; level?: Accessor<number>; label: Accessor<string> }) {
  return (
    <box cssClasses={["osd"]} spacing={12}>
      <image iconName={icon} pixelSize={20} />
      {level && <levelbar hexpand value={level} />}
      <label
        cssClasses={["osd-label"]}
        label={label}
        widthChars={level ? 4 : -1}
        maxWidthChars={level ? -1 : 40}
        ellipsize={Pango.EllipsizeMode.END}
        xalign={level ? 1 : 0}
        hexpand={!level}
      />
    </box>
  )
}

const contents: Record<OsdKind, () => JSX.Element> = {
  volume: () => (
    <WithDefault device="defaultSpeaker">
      {(speaker) => {
        const mute = createBinding(speaker, "mute")
        const volume = createBinding(speaker, "volume")
        return (
          <Level
            icon={createBinding(speaker, "volumeIcon")}
            level={createComputed(() => (mute() ? 0 : volume()))}
            label={createComputed(() => (mute() ? "Muted" : `${Math.round(volume() * 100)}%`))}
          />
        )
      }}
    </WithDefault>
  ),
  brightness: () => (
    <Level icon="display-brightness-symbolic" level={brightness} label={brightness.as((it) => `${Math.round(it * 100)}%`)} />
  ),
  microphone: () => (
    <WithDefault device="defaultMicrophone">
      {(microphone) => {
        const mute = createBinding(microphone, "mute")
        return (
          <Level
            icon={mute.as((it) => (it ? "microphone-disabled-symbolic" : "audio-input-microphone-symbolic"))}
            label={mute.as((it) => (it ? "Microphone muted" : "Microphone on"))}
          />
        )
      }}
    </WithDefault>
  ),
  media: () => (
    <With value={current}>
      {(player) => (
        <box>
          {player && (
            <Level
              icon={createBinding(player, "playbackStatus").as((it) =>
                it === AstalMpris.PlaybackStatus.PLAYING ? "media-playback-start-symbolic" : "media-playback-pause-symbolic",
              )}
              label={createComputed(() => {
                const title = createBinding(player, "title")() || player.identity
                const artist = createBinding(player, "artist")()
                return artist ? `${title} — ${artist}` : title
              })}
            />
          )}
        </box>
      )}
    </With>
  ),
}

export default function Osd({ monitor }: { monitor: Gdk.Monitor }) {
  const focused = focusedOutput.as((it) => it === monitor.connector)

  return (
    <window
      visible={createComputed(() => focused() && shown() !== null)}
      namespace="system-overlay-osd"
      cssClasses={["Osd"]}
      gdkmonitor={monitor}
      anchor={Astal.WindowAnchor.TOP}
      exclusivity={Astal.Exclusivity.NORMAL}
      application={app}
      $={(self) => onCleanup(() => self.destroy())}
    >
      {/* the box keeps the device With inside some contents from nesting directly in this With, which gnim doesn't support */}
      <With value={shown}>{(kind: OsdKind | null) => <box>{kind && contents[kind]()}</box>}</With>
    </window>
  )
}
