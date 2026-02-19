import { createPoll } from "ags/time"
import Gtk from "gi://Gtk?version=4.0"
import Dot from "./Dot"

export default function Calendar() {
    const time = createPoll("", 1000, "date +%H:%M")
    const date = createPoll("", 1000, "date +%d/%m")

    return <box
        cssName="calendar_box"
    >
        <menubutton>
            <box
                valign={Gtk.Align.CENTER}
            >
                <label label={time} />
                <box widthRequest={4} />
                <Dot />
                <box widthRequest={4} />
                <label label={date} />
            </box>
            <popover>
                <Gtk.Calendar />
            </popover>
        </menubutton>
    </box>
}
