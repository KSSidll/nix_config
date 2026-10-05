import { Accessor } from "ags"
import PanelButton from "./PanelButton"
import { PanelContent } from "./panels"
import { ScrollSteps } from "./scroll"

type Text = string | Accessor<string>

export default function Indicator({
  icon,
  label,
  labelChars,
  cssClasses = [],
  ...button
}: {
  icon: Text
  label?: Text
  labelChars?: number
  tooltip?: Text
  cssClasses?: string[] | Accessor<string[]>
  onScroll?: ScrollSteps
  onMiddleClick?: () => void
  panel: PanelContent
}) {
  const classes = cssClasses instanceof Accessor
    ? cssClasses.as((it) => ["indicator", ...it])
    : ["indicator", ...cssClasses]

  return (
    <PanelButton cssClasses={classes} {...button}>
      <box spacing={4}>
        <image iconName={icon} />
        {label !== undefined && <label label={label} widthChars={labelChars ?? -1} xalign={1} />}
      </box>
    </PanelButton>
  )
}
