import { createBinding, For } from "ags"
import Gdk from "gi://Gdk?version=4.0"
import Gio from "gi://Gio"
import Gtk from "gi://Gtk?version=4.0"
import AstalTray from "gi://AstalTray"
import { trackMenu } from "./panels"

// GTK's popover menu mishandles a submenu rebuilt in place: it keeps the old submenu page, whose items point at ids
// the app has dropped, next to the new one. Apps rebuild their menus on any change (Portmaster every minute, and on
// each open), so GTK is given a copy, replaced whole on every change.
function snapshot(model: Gio.MenuModel): Gio.Menu {
  const menu = new Gio.Menu()
  for (let index = 0; index < model.get_n_items(); index++) {
    const item = Gio.MenuItem.new(null, null)
    const attributes = model.iterate_item_attributes(index)
    while (attributes.next()) item.set_attribute_value(attributes.get_name(), attributes.get_value())
    const links = model.iterate_item_links(index)
    while (links.next()) item.set_link(links.get_name(), snapshot(links.get_value()))
    menu.append_item(item)
  }
  return menu
}

function TrayItem({ item }: { item: AstalTray.TrayItem }) {
  const attach = (button: Gtk.MenuButton) => {
    trackMenu(button)
    const refresh = () => {
      const menu = item.menuModel && snapshot(item.menuModel)
      // an open menu is updated in place; setting the button's model would replace, and so close, it
      if (button.popover instanceof Gtk.PopoverMenu) button.popover.menuModel = menu
      else button.menuModel = menu
    }
    refresh()
    item.connect("notify::menu-model", refresh)
    button.insert_action_group("dbusmenu", item.actionGroup)
    item.connect("notify::action-group", () => button.insert_action_group("dbusmenu", item.actionGroup))
    // dbusmenu apps fill their menu lazily, only after being told it is about to show
    button.connect("notify::active", () => button.active && item.about_to_show())
  }

  return (
    <menubutton
      cssClasses={["tray-item"]}
      tooltipMarkup={createBinding(item, "tooltipMarkup")}
      $={attach}
    >
      <Gtk.GestureClick
        button={Gdk.BUTTON_PRIMARY}
        propagationPhase={Gtk.PropagationPhase.CAPTURE}
        onPressed={(gesture) => {
          if (item.isMenu) return
          gesture.set_state(Gtk.EventSequenceState.CLAIMED)
          item.activate(0, 0)
        }}
      />
      <Gtk.GestureClick
        button={Gdk.BUTTON_SECONDARY}
        onPressed={(gesture) => (gesture.widget as Gtk.MenuButton).popup()}
      />
      <image gicon={createBinding(item, "gicon")} pixelSize={16} />
    </menubutton>
  )
}

export default function Tray() {
  const items = createBinding(AstalTray.get_default(), "items")

  return (
    <box cssClasses={["tray"]} spacing={8} visible={items.as((it) => it.length > 0)}>
      <For each={items}>{(item) => <TrayItem item={item} />}</For>
    </box>
  )
}
