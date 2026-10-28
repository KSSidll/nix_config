import { createState } from "ags"
import AstalMpris from "gi://AstalMpris"
import { action, windowOfBusName } from "../niri"

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

export async function focusPlayer(player: AstalMpris.Player) {
  try {
    const window = await windowOfBusName(player.busName)
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
