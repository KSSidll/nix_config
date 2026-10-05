import { createBinding, createComputed, createState } from "ags"
import Gtk from "gi://Gtk?version=4.0"
import { nightLight, widgets } from "../../config"
import PanelButton from "../PanelButton"
import { notifd } from "../notifications/state"
import { changeVolume, hasBacklight, toggleMute } from "../controls"
import { showOsd } from "../osd/state"
import { MicrophoneTile, OutputPage, volumeScroll, VolumeSlider, WithDefault } from "./audio"
import { batteryStatus } from "./battery"
import { BluetoothPage, BluetoothPairPage, bluetoothStatus, BluetoothTile } from "./bluetooth"
import { BrightnessSlider } from "./brightness"
import { CapturePage, RecordTile, ScreenshotTile } from "./capture"
import { DisplaysPage, DisplaysTile, hasExternals } from "./displays"
import { IdlePage, KeepAwakeTile } from "./idle"
import { networkStatus, NetworkPage, NetworkTile } from "./network"
import { NightLightTile } from "./nightlight"
import { registerPromptAnchor } from "../agents/prompt"
import { lock, PowerPage, suspend } from "./power"
import { PowerProfileTile } from "./powerprofiles"
import Tile from "./Tile"
import { VpnPage, vpnStatus, VpnTile } from "./vpn"

type Page = "main" | "network" | "vpn" | "bluetooth" | "bluetooth-pair" | "idle" | "output" | "power" | "capture" | "displays"

function DoNotDisturbTile() {
  const dontDisturb = createBinding(notifd, "dontDisturb")
  return (
    <Tile
      icon={dontDisturb.as((it) => (it ? "notifications-disabled-symbolic" : "notifications-symbolic"))}
      title="Do not disturb"
      subtitle={dontDisturb.as((it) => (it ? "On" : "Off"))}
      active={dontDisturb}
      onToggle={() => (notifd.dontDisturb = !notifd.dontDisturb)}
    />
  )
}

function Header({ onPower }: { onPower: () => void }) {
  const battery = widgets.battery ? batteryStatus() : null

  return (
    <box cssClasses={["quick-settings-header"]} spacing={4}>
      {battery && (
        <box cssClasses={battery.level.as((it) => ["battery", ...it])} spacing={6} tooltipText={battery.power}>
          <image iconName={battery.icon} />
          <label label={battery.percentage} />
          <label cssClasses={["value"]} label={battery.status} />
        </box>
      )}
      <box hexpand />
      <button cssClasses={["icon-button"]} tooltipText="Lock" onClicked={lock}>
        <image iconName="system-lock-screen-symbolic" />
      </button>
      <button cssClasses={["icon-button"]} tooltipText="Suspend" onClicked={suspend}>
        <image iconName="system-suspend-symbolic" />
      </button>
      <button cssClasses={["icon-button"]} tooltipText="Power" onClicked={onPower}>
        <image iconName="system-shutdown-symbolic" />
      </button>
    </box>
  )
}

function QuickSettingsPanel() {
  const [page, setPage] = createState<Page>("main")
  const back = () => setPage("main")

  const tiles = [
    <NetworkTile onDetails={() => setPage("network")} />,
    <VpnTile onDetails={() => setPage("vpn")} />,
    widgets.bluetooth && <BluetoothTile onDetails={() => setPage("bluetooth")} />,
    <DoNotDisturbTile />,
    <MicrophoneTile />,
    widgets.powerProfiles && <PowerProfileTile />,
    <KeepAwakeTile onDetails={() => setPage("idle")} />,
    nightLight && <NightLightTile />,
    <ScreenshotTile onDetails={() => setPage("capture")} />,
    <RecordTile onDetails={() => setPage("capture")} />,
    hasExternals() && <DisplaysTile onDetails={() => setPage("displays")} />,
  ].filter((it) => it !== false)
  const rows = Array.from({ length: Math.ceil(tiles.length / 2) }, (_, row) => tiles.slice(row * 2, row * 2 + 2))

  return (
    <Gtk.Stack
      cssClasses={["quick-settings"]}
      visibleChildName={page}
      transitionType={Gtk.StackTransitionType.SLIDE_LEFT_RIGHT}
      vhomogeneous={false}
      interpolateSize
    >
      <box $type="named" name="main" cssClasses={["panel"]} orientation={Gtk.Orientation.VERTICAL} spacing={10}>
        <Header onPower={() => setPage("power")} />
        <Gtk.Separator />
        <VolumeSlider onDetails={() => setPage("output")} />
        {hasBacklight && <BrightnessSlider />}
        <Gtk.Separator />
        <box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
          {rows.map((row) => (
            <box spacing={8} homogeneous>
              {row}
              {row.length === 1 && <box />}
            </box>
          ))}
        </box>
      </box>
      <box $type="named" name="network">
        <NetworkPage onBack={back} />
      </box>
      <box $type="named" name="vpn">
        <VpnPage onBack={back} />
      </box>
      {widgets.bluetooth && (
        <box $type="named" name="bluetooth">
          <BluetoothPage onBack={back} onPairNew={() => setPage("bluetooth-pair")} />
        </box>
      )}
      {widgets.bluetooth && (
        <box $type="named" name="bluetooth-pair">
          <BluetoothPairPage onBack={() => setPage("bluetooth")} />
        </box>
      )}
      <box $type="named" name="idle">
        <IdlePage onBack={back} />
      </box>
      <box $type="named" name="output">
        <OutputPage onBack={back} />
      </box>
      <box $type="named" name="power">
        <PowerPage onBack={back} />
      </box>
      <box $type="named" name="capture">
        <CapturePage onBack={back} />
      </box>
      <box $type="named" name="displays">
        <DisplaysPage onBack={back} />
      </box>
    </Gtk.Stack>
  )
}

export default function QuickSettings() {
  const network = networkStatus()
  const vpn = vpnStatus()
  const battery = widgets.battery ? batteryStatus() : null
  const bluetooth = widgets.bluetooth ? bluetoothStatus() : null
  const tooltip = createComputed(() =>
    [network.label(), vpn.on() && `VPN: ${vpn.label()}`, battery?.status()].filter(Boolean).join(" · "),
  )

  return (
    <PanelButton
      cssClasses={["quick-settings-button"]}
      tooltip={tooltip}
      onScroll={{ ...volumeScroll, onSteps: (steps) => (changeVolume(-steps), showOsd("volume")) }}
      onMiddleClick={() => (toggleMute(), showOsd("volume"))}
      panel={() => <QuickSettingsPanel />}
      onSetup={registerPromptAnchor}
    >
      <box spacing={10}>
        <image iconName={network.icon} />
        <image iconName="network-vpn-symbolic" visible={vpn.on} cssClasses={vpn.connecting.as((it) => (it ? ["connecting"] : []))} />
        {bluetooth && <image iconName="bluetooth-active-symbolic" visible={bluetooth.connected} />}
        <WithDefault device="defaultSpeaker">
          {(speaker) => (
            <image
              cssClasses={createBinding(speaker, "mute").as((it) => (it ? ["muted"] : []))}
              iconName={createBinding(speaker, "volumeIcon")}
            />
          )}
        </WithDefault>
        {battery && (
          <box cssClasses={battery.level.as((it) => ["battery", ...it])} spacing={4}>
            <image iconName={battery.icon} />
            <label label={battery.percentage} widthChars={4} xalign={1} />
          </box>
        )}
      </box>
    </PanelButton>
  )
}
