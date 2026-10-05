import { createBinding, createComputed, For } from "ags"
import Gtk from "gi://Gtk?version=4.0"
import AstalNotifd from "gi://AstalNotifd"
import Indicator from "../Indicator"
import Panel from "../Panel"
import NotificationCard from "./NotificationCard"
import { markSeen, notifd, unseen } from "./state"

type Group = { app: string; notifications: AstalNotifd.Notification[] }

// newest first, grouped by app; the group with the newest notification leads
function groupByApp(all: AstalNotifd.Notification[]): Group[] {
  const groups = new Map<string, AstalNotifd.Notification[]>()
  for (const notification of [...all].sort((a, b) => b.time - a.time)) {
    const app = notification.appName || "Other"
    groups.set(app, [...(groups.get(app) ?? []), notification])
  }
  return [...groups].map(([app, notifications]) => ({ app, notifications }))
}

function NotificationList() {
  const all = createBinding(notifd, "notifications")

  return (
    <box orientation={Gtk.Orientation.VERTICAL} widthRequest={360}>
      <label cssClasses={["empty"]} label="No notifications" visible={all.as((it) => it.length === 0)} />
      <Gtk.ScrolledWindow
        hscrollbarPolicy={Gtk.PolicyType.NEVER}
        propagateNaturalHeight
        maxContentHeight={480}
        visible={all.as((it) => it.length > 0)}
      >
        <box cssClasses={["notification-list"]} orientation={Gtk.Orientation.VERTICAL} spacing={12}>
          <For each={all.as(groupByApp)}>
            {(group: Group) => (
              <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
                <label cssClasses={["group-title"]} label={group.app} xalign={0} />
                {group.notifications.map((notification) => <NotificationCard notification={notification} showApp={false} />)}
              </box>
            )}
          </For>
        </box>
      </Gtk.ScrolledWindow>
    </box>
  )
}

export default function Notifications() {
  const dontDisturb = createBinding(notifd, "dontDisturb")

  return (
    <Indicator
      icon={dontDisturb.as((it) => (it ? "notifications-disabled-symbolic" : "notifications-symbolic"))}
      tooltip={createBinding(notifd, "notifications").as((it) => (it.length ? `${it.length} notifications` : "No notifications"))}
      cssClasses={createComputed(() => ["notifications", ...(unseen() ? ["unseen"] : [])])}
      panel={() => {
        markSeen()
        return (
          <Panel
            title="Notifications"
            control={
              <box spacing={8}>
                <label cssClasses={["value"]} label="Do not disturb" />
                <switch valign={Gtk.Align.CENTER} active={dontDisturb} onNotifyActive={({ active }) => (notifd.dontDisturb = active)} />
              </box>
            }
            footer={[{ label: "Clear all", onClicked: () => notifd.notifications.forEach((it) => it.dismiss()) }]}
          >
            <NotificationList />
          </Panel>
        )
      }}
    />
  )
}
