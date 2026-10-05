import { createState } from "ags"
import Gio from "gi://Gio"
import GLib from "gi://GLib"
import AstalMpris from "gi://AstalMpris"
import { action, query, Window } from "../niri"

Gio._promisify(Gio.DBusConnection.prototype, "call", "call_finish")

const { PLAYING } = AstalMpris.PlaybackStatus

const [players, setPlayers] = createState<AstalMpris.Player[]>([])
// the player that most recently started playing: the media keys control it and the media panel shows it first.
// Browsers keep a player per tab that ever played, so the first in the list is usually a stale one.
const [current, setCurrent] = createState<AstalMpris.Player | null>(null)
const [playing, setPlaying] = createState(false)
export { players, current, playing }

export type MediaCommand = "play-pause" | "next" | "previous"

export function control(command: MediaCommand) {
  const player = current.get()
  if (!player) return false
  if (command === "play-pause") player.play_pause()
  else if (command === "next") player.next()
  else player.previous()
  return true
}

// An app raising itself over MPRIS has no activation token, which niri can refuse; the player's window is found
// through the process that owns its bus name instead.
export async function focusPlayer(player: AstalMpris.Player) {
  try {
    const reply = await Gio.DBus.session.call(
      "org.freedesktop.DBus",
      "/org/freedesktop/DBus",
      "org.freedesktop.DBus",
      "GetConnectionUnixProcessID",
      new GLib.Variant("(s)", [player.busName]),
      null,
      Gio.DBusCallFlags.NONE,
      -1,
      null,
    )
    const [pid] = reply.deepUnpack() as [number]
    const window = (await query<Window[]>("Windows")).find((it) => it.pid === pid)
    if (window) return action({ FocusWindow: { id: window.id } })
  } catch (error) {
    console.error(`Failed to find the window of a player [${player.busName}]: ${error}`)
  }
  player.raise()
}

export function startMedia() {
  const mpris = AstalMpris.get_default()
  const handlers = new Map<AstalMpris.Player, number>()

  const update = (closed?: AstalMpris.Player) => {
    const all = mpris.players.filter((it) => it !== closed)
    const now = current.get()
    if (!now || !all.includes(now)) setCurrent(all.find((it) => it.playbackStatus === PLAYING) ?? all[0] ?? null)
    setPlayers(all)
    setPlaying(all.some((it) => it.playbackStatus === PLAYING))
  }

  const track = (player: AstalMpris.Player) => {
    handlers.set(
      player,
      player.connect("notify::playback-status", () => {
        if (player.playbackStatus === PLAYING) setCurrent(player)
        update()
      }),
    )
  }

  mpris.players.forEach(track)
  mpris.connect("player-added", (_, player) => {
    track(player)
    update()
  })
  mpris.connect("player-closed", (_, player) => {
    const handler = handlers.get(player)
    if (handler !== undefined) player.disconnect(handler)
    handlers.delete(player)
    update(player)
  })
  update()
}
