import { createComputed, createState } from "ags"
import AstalWp from "gi://AstalWp"
import Wp from "gi://Wp?version=0.5"

// initializes the WirePlumber library, which a core can't be made without
AstalWp.get_default()

// AstalWp doesn't track links, and a link is the only thing that says which stream feeds which
const core = new Wp.Core()
const linkManager = new Wp.ObjectManager()
linkManager.add_interest_full(Wp.ObjectInterest.new_type(Wp.Link.$gtype))
linkManager.request_object_features(Wp.Link.$gtype, Wp.ProxyFeatures.PIPEWIRE_OBJECT_FEATURES_MINIMAL)

type Link = { from: number; to: number }
const known = new Map<number, Link>()
const [found, setFound] = createState<Link[]>([])

linkManager.connect("object-added", (_, object) => {
  const link = object as Wp.Link
  const [from, , to] = link.get_linked_object_ids()
  known.set(link.get_bound_id(), { from, to })
  setFound([...known.values()])
})
linkManager.connect("object-removed", (_, object) => {
  known.delete((object as Wp.Link).get_bound_id())
  setFound([...known.values()])
})
core.install_object_manager(linkManager)
if (!core.connect()) console.error("[privacy] couldn't connect to PipeWire, so streams won't name what they're linked to")

// node ids, one entry per linked node pair: an audio stream links once per channel
export const links = createComputed(() => {
  // GJS frees objects that only top-level code refers to, which drops the link watch; this function lives as long as
  // the bar
  void [core, linkManager]
  const pairs = new Map(found().map((link) => [`${link.from}-${link.to}`, link]))
  return [...pairs.values()]
})
