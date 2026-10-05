import Gio from "gi://Gio"
import GObject from "gi://GObject"
import NM from "gi://NM"
import AstalNetwork from "gi://AstalNetwork"

// GJS returns a promise from an async method only once it is promisified
Gio._promisify(NM.Client.prototype, "add_and_activate_connection_async", "add_and_activate_connection_finish")
Gio._promisify(NM.Client.prototype, "activate_connection_async", "activate_connection_finish")
Gio._promisify(NM.Client.prototype, "deactivate_connection_async", "deactivate_connection_finish")
Gio._promisify(NM.RemoteConnection.prototype, "delete_async", "delete_finish")
Gio._promisify(NM.RemoteConnection.prototype, "update2", "update2_finish")

export const client = AstalNetwork.get_default().client

export class ActivationError extends Error {
  constructor(readonly reason: NM.ActiveConnectionStateReason) {
    super(`activation failed [reason: ${reason}]`)
  }
}

// settles once the connection is up, or fails with the reason it went down instead
export function activation(active: NM.ActiveConnection) {
  const { ACTIVATED, DEACTIVATED } = NM.ActiveConnectionState
  return new Promise<void>((resolve, reject) => {
    const settle = (state: NM.ActiveConnectionState, reason: NM.ActiveConnectionStateReason) => {
      if (state !== ACTIVATED && state !== DEACTIVATED) return
      GObject.signal_handler_disconnect(active, handler)
      if (state === ACTIVATED) resolve()
      else reject(new ActivationError(reason))
    }
    const handler = active.connect("state-changed", (_, state, reason) => settle(state, reason))
    settle(active.state, active.get_state_reason())
  })
}
