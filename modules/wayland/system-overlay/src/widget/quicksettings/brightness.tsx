import { brightness, setBrightness } from "../controls"

export function BrightnessSlider() {
  return (
    <box cssClasses={["slider-row"]} spacing={8}>
      <box cssClasses={["icon-button"]}>
        <image iconName="display-brightness-symbolic" />
      </box>
      <slider hexpand value={brightness} onChangeValue={(_, __, value) => setBrightness(value)} />
      <label cssClasses={["value"]} label={brightness.as((it) => `${Math.round(it * 100)}%`)} widthChars={4} xalign={1} />
      {/* keeps the slider aligned with the volume row, which ends in a details button */}
      <box cssClasses={["icon-button", "placeholder"]}>
        <image iconName="go-next-symbolic" opacity={0} />
      </box>
    </box>
  )
}
