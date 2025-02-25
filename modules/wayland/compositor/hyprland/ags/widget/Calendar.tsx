import { Variable } from "astal"
import { Gtk } from "astal/gtk4"
import Dot from "./Dot"

const time = Variable("").poll(1000, "date +%H:%M")
const date = Variable("").poll(1000, "date +%d/%m")

export default function Calendar() {
    return <box
        cssName="calendar_box"
    >
        <menubutton>
            <box
                halign={Gtk.Align.CENTER}
            >
                <label label={time()} />
                <box widthRequest={4} />
                <Dot />
                <box widthRequest={4} />
                <label label={date()} />
            </box>
            <popover>
                <Gtk.Calendar />
            </popover>
        </menubutton>
    </box>
}
