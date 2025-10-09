import Gtk from "gi://Gtk?version=4.0";

export default function Dot() {
    return <box>
        <box valign={Gtk.Align.CENTER} marginTop={1} >
            <box cssName="dot" heightRequest={3} widthRequest={3} />
        </box>
    </box>
}