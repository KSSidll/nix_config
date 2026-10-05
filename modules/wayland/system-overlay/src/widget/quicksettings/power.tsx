import Gtk from "gi://Gtk?version=4.0"
import { sleep } from "../../config"
import { createConfirm } from "../confirm"
import Panel from "../Panel"
import { run } from "../panels"

// hypridle's lock_cmd starts the lock screen, once
export const lock = () => run(["loginctl", "lock-session"])
export const suspend = () => run(["systemctl", sleep])

const actions = [
  { id: "logout", label: "Log out", icon: "system-log-out-symbolic", command: ["niri", "msg", "action", "quit", "--skip-confirmation"] },
  { id: "reboot", label: "Reboot", icon: "system-reboot-symbolic", command: ["systemctl", "reboot"] },
  { id: "poweroff", label: "Shut down", icon: "system-shutdown-symbolic", command: ["systemctl", "poweroff"] },
]

// each action asks for a second click within a few seconds before it runs
export function PowerPage({ onBack }: { onBack: () => void }) {
  const { armed, press: confirm } = createConfirm<string>()
  const press = (action: (typeof actions)[number]) => confirm(action.id, () => run(action.command))

  return (
    <Panel title="Power" onBack={onBack}>
      <box orientation={Gtk.Orientation.VERTICAL}>
        {actions.map((action) => (
          <button
            cssClasses={armed.as((it) => (it === action.id ? ["row", "armed"] : ["row"]))}
            onClicked={() => press(action)}
          >
            <box spacing={10}>
              <image iconName={action.icon} />
              <label label={armed.as((it) => (it === action.id ? `${action.label}? Click again` : action.label))} xalign={0} />
            </box>
          </button>
        ))}
      </box>
    </Panel>
  )
}
