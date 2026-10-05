# NixOS config

Flake with two hosts, `laptop` and `mainpc` (`hosts/<name>`), built from shared modules under `modules/`. Home Manager runs as a NixOS module (`modules/core/home-manager.nix`).

## Building

- Builds are `--impure`: each host imports `/etc/nixos/hardware-configuration.nix`, which stays out of this public repo.
- Verify a change with
  `nix build --impure --no-link --print-out-paths .#nixosConfigurations.laptop.config.system.build.toplevel`
  and check the exit status (`${pipestatus[1]}` in zsh), not the last line: a failed build still ends with an "Output paths" listing.
- The user applies changes with `git add -A flake.nix flake.lock hosts modules && nix-rebuild-flake-laptop` (`nix-rebuild-flake-pc` on mainpc). Never run the switch yourself.
- The repo is synced between both hosts by Syncthing, `.git` included.

## The git index belongs to the user

Never commit, stage, `git mv` or `git rm`; move and delete with plain `mv` and `rm`.

A `git+file` flake only sees tracked files, so a build that needs new files adds them intent-to-add and removes them again. Build the list as a zsh array, because an empty `git reset --` resets the whole index:

```zsh
U=(${(f)"$(git ls-files --others --exclude-standard flake.nix hosts modules)"})
(( ${#U} )) && git add -N -- $U
# build
(( ${#U} )) && git reset -q -- $U
```

Compare `git status --short` before and after. Don't build from a `path:` ref instead: it copies the ignored `node_modules` and `@girs` into the overlay source.

## Home Manager directory links

When a `home.file."<dir>".source = ./dir` link becomes individually managed files inside that directory, activation fails with `cannot move … .hm-backup: Read-only file system`. Before switching, each host needs the old store symlink removed: `[ -L ~/.config/<dir> ] && rm ~/.config/<dir>`.

## niri

The compositor is niri, run as its own systemd session; the bar, wallpaper (swaybg), hypridle and Portmaster's tray are user services started with `graphical-session.target`. Its config is KDL written in `modules/wayland/compositor/niri/default.nix` with theme values interpolated, and the build runs `niri validate` on it, so a bad config fails the build rather than the session. KDL strings don't accept regex escapes like `\.`; use raw strings (`r"^org\.app$"`).

- `niri msg` reads state (`workspaces`, `windows`, `layers`, `outputs`) and runs actions (`niri msg action focus-workspace-down`).
- Output settings can be tried live with `niri msg output eDP-1 scale 1.5`; they last until niri restarts. Hosts set them through `niri.outputs`.
- niri reloads `config.kdl` when it changes, so a switch applies config changes to the running session.

## System overlay

`modules/wayland/system-overlay` is the bar, panels, notifications, OSD and NetworkManager secret agent: ags v3 (gnim, GTK 4) in `src/`.

- `astal.nix` lists the Astal libraries, shared by the package and the `ags` dev shell so both run the same builds. Fixes to Astal go in `patches/` as Nix patches.
- Widgets that need a system service are options under `systemOverlay.widgets`, and each one enables its service (`battery` → upower, `bluetooth` → bluez, `powerProfiles` → power-profiles-daemon). `src/generated/config.json` carries the options to the TypeScript side.
- `sh src/dev.sh` refreshes the TypeScript types, `dev.sh check` type-checks once. `ags types` reorders `tsconfig.json`; restore it with `git restore`.

### Dev loop

`sh modules/wayland/system-overlay/src/dev.sh run`, in the background with output to a log file, stops the `system-overlay` user service and runs the source tree instead. It restarts on every save and prints `types: ok` or the type errors after each change. Stop it with `pkill -x watchexec`; its trap starts the service again. Leave it running when the user wants to watch changes live.

Before testing a change, wait for the restart to finish: compare the `gjs -m /run/user/1000/ags.js` PID before and after, or grep the bundle `/run/user/1000/ags.js` for the change.

### Driving the cursor

Test the overlay with real pointer input rather than asking the user to click. Build the tools once into a scratch directory `$S`:

```sh
nix build nixpkgs#wlrctl -o $S/wlrctl && nix build nixpkgs#grim -o $S/grim
```

niri can't warp the pointer, but it accepts wlrctl's virtual pointer, whose relative motion is unaccelerated. Each click pushes the pointer into the bottom-left corner, moves it to the target, then clicks; the top-left corner is niri's hot corner and opens the overview (`niri msg action close-overview` closes it):

```sh
click() {
  $S/wlrctl/bin/wlrctl pointer move -10000 10000
  $S/wlrctl/bin/wlrctl pointer move $1 $(( $2 - 720 ))   # 720: the output's logical height
  sleep 0.15
  $S/wlrctl/bin/wlrctl pointer click ${3:-left}
}
click 1160 12; sleep 0.5
$S/grim/bin/grim -o eDP-1 $S/shot.png   # -c draws the cursor too
```

`wlrctl pointer scroll <dy> <dx>` arrives as smooth (touchpad-like) scrolling; the workspaces widget needs at least 30 per step.

- Coordinates are logical. The laptop's eDP-1 is 1920x1080 at scale 1.5, so 1280x720 logical: divide screenshot pixels by 1.5. On the bar: clock about (640, 12), quick settings about (1160, 12).
- Crop screenshots (`magick shot.png -crop WxH+X+Y`) before reading them.
- `niri msg layers` shows which overlay surfaces are open (`system-overlay-panels` while a panel is up).
- For behaviour a screenshot can't show, add temporary `[debug]` log lines and read the dev loop's log; remove them afterwards.
- Never send keyboard input with wlrctl: the focused window is usually the terminal.
- Restore any state a test changes (Wi-Fi, Bluetooth, power mode, Do not disturb, volume). Never turn Wi-Fi off or switch networks; the session may depend on it.
- Kill test processes by PID, not `pkill -f` with a pattern that also matches your own shell's command line.

### Overlay gotchas

- GJS frees an object once no live function refers to its wrapper, and top-level module code alone doesn't count: a `Gio.DBusExportedObject` gets unexported, a `Wp.Core` stops delivering events. Refer to such objects from a function that lives as long as the bar. Force a collection to check: `import System from "system"; System.gc()`.
- Synchronous Astal methods that wait on a device or the network (e.g. `AstalBluetooth.Device.pair`) freeze the whole bar; call the D-Bus method asynchronously instead.
- Async GI methods return promises only after `Gio._promisify(Class.prototype, "method", "method_finish")`.
- `journalctl` reads the system journal and every user's journal without root (`wheel` has read access), so a system service's failure is in its log: `journalctl -b -u NetworkManager`.
