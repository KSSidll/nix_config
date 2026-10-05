#!/bin/sh
# usage: dev.sh [types|check|run]
#   types  refresh the TypeScript types (default)
#   check  type-check the source tree once
#   run    replace the installed overlay with this source tree, restarting and type-checking on every change;
#          the installed overlay comes back when this exits
cd "$(dirname "$0")" || exit 1
nix build --impure "$HOME/.config/nix#nixosConfigurations.$(hostname).config.systemOverlay.generated" -o generated || exit 1

# ags and gnim ship TypeScript sources, which tsc checks against the generated GI types; only errors in this tree count
check='errors=$(tsc --noEmit --pretty false -p . | grep "error TS" | grep -v "^\.\./")
if [ -z "$errors" ]; then echo "types: ok"; else echo "$errors"; echo "types: $(echo "$errors" | wc -l) errors"; exit 1; fi'

case "${1:-types}" in
  types)
    exec nix develop ~/.config/nix#ags --command ags types -u -d .
    ;;
  check)
    exec nix develop ~/.config/nix#ags --command sh -c "$check"
    ;;
  run)
    # both instances use ags' default instance name, so only one can run
    systemctl --user stop system-overlay.service
    # job control puts the checker in its own process group, so the trap stops it with everything it started
    set -m
    nix develop ~/.config/nix#ags --command watchexec --quiet --shell=none --on-busy-update=restart --exts ts,tsx,json \
      --ignore=node_modules --ignore=@girs --ignore=generated \
      -- sh -c "$check" &
    checker=$!
    set +m
    trap 'kill -- -$checker 2>/dev/null; systemctl --user start system-overlay.service' EXIT
    nix develop ~/.config/nix#ags --command watchexec --shell=none --restart --exts ts,tsx,scss,json \
      --ignore=node_modules --ignore=@girs \
      -- ags run app.tsx --gtk 4
    ;;
  *)
    echo "usage: $0 [types|check|run]" >&2
    exit 1
    ;;
esac
