import { Variable } from "astal"
import { Gtk } from "astal/gtk4"


const time = Variable("").poll(1000, "date +%T")
const date = Variable("").poll(1000, "date +%d.%m.%Y")

export default function Calendar() {
    return <box
        cssName="bar_overlay_calendar_box"
    >
        <menubutton>
            <box
                orientation={Gtk.Orientation.VERTICAL}
                halign={Gtk.Align.CENTER}
            >
                <label label={time()} />
                <box heightRequest={1} />
                <label label={date()} />
            </box>
            <popover>
                <Gtk.Calendar />
            </popover>
        </menubutton>
    </box>
}
