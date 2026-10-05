import { createState } from "ags"
import AstalNotifd from "gi://AstalNotifd"

const maxPopups = 4

export const notifd = AstalNotifd.get_default()
// notifications stay in the history until dismissed; how long a popup shows is the popup's own decision
notifd.ignoreTimeout = true

const [popups, setPopups] = createState<AstalNotifd.Notification[]>([])
const [unseen, setUnseen] = createState(false)
export { popups, unseen }

notifd.connect("notified", (_, id) => {
  const notification = notifd.get_notification(id)
  if (!notification) return
  setUnseen(true)
  if (notifd.dontDisturb && notification.urgency !== AstalNotifd.Urgency.CRITICAL) return
  const others = popups.get().filter((it) => it.id !== id)
  setPopups([notification, ...others].slice(0, maxPopups))
})

notifd.connect("resolved", (_, id) => hidePopup(id))

export function hidePopup(id: number) {
  setPopups(popups.get().filter((it) => it.id !== id))
}

export function markSeen() {
  setUnseen(false)
  setPopups([])
}
