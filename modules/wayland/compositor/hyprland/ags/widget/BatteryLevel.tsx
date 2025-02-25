import { bind, Variable } from "astal"
import { Gtk } from "astal/gtk4"
import Battery from "gi://AstalBattery"
import { getPathFor } from "../helper"

const battery = Battery.get_default()
const batteryPercentage = bind(battery, "percentage").as(it => Math.round(it * 100))
const batteryCharging = bind(battery, "charging")

const batteryIconPath = Variable("")
batteryCharging.subscribe(_ => updateBatteryIconPath())
batteryPercentage.subscribe(_ => updateBatteryIconPath())

function updateBatteryIconPath() {
    if (batteryCharging.get()) {
        if (batteryPercentage.get() > 99) { batteryIconPath.set(getPathFor("/assets/battery_full_charging.svg")) }
        else if (batteryPercentage.get() > 90) { batteryIconPath.set(getPathFor("/assets/battery_90_charging.svg")) }
        else if (batteryPercentage.get() > 80) { batteryIconPath.set(getPathFor("/assets/battery_80_charging.svg")) }
        else if (batteryPercentage.get() > 60) { batteryIconPath.set(getPathFor("/assets/battery_60_charging.svg")) }
        else if (batteryPercentage.get() > 40) { batteryIconPath.set(getPathFor("/assets/battery_40_charging.svg")) }
        else if (batteryPercentage.get() > 20) { batteryIconPath.set(getPathFor("/assets/battery_20_charging.svg")) }
        else { batteryIconPath.set("assets/battery_00_charging.svg") }
    } else {
        if (batteryPercentage.get() > 99) { batteryIconPath.set(getPathFor("/assets/battery_full.svg")) }
        else if (batteryPercentage.get() > 90) { batteryIconPath.set(getPathFor("/assets/battery_90.svg")) }
        else if (batteryPercentage.get() > 80) { batteryIconPath.set(getPathFor("/assets/battery_80.svg")) }
        else if (batteryPercentage.get() > 60) { batteryIconPath.set(getPathFor("/assets/battery_60.svg")) }
        else if (batteryPercentage.get() > 40) { batteryIconPath.set(getPathFor("/assets/battery_40.svg")) }
        else if (batteryPercentage.get() > 20) { batteryIconPath.set(getPathFor("/assets/battery_20.svg")) }
        else { batteryIconPath.set(getPathFor("/assets/battery_00.svg")) }
    }
}

export default function BatteryLevel() {
    updateBatteryIconPath()

    return <box
        cssName="battery_box"
    >
        <box
            valign={Gtk.Align.CENTER}
        >
            <image
                cssName="battery_icon"
                file={batteryIconPath()}
                pixelSize={16}
            />

            <box widthRequest={1} />

            <label
                cssName="battery_label"
                label={batteryPercentage.as(it => `${it}%`)}
            />
        </box>
    </box>
}
