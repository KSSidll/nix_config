#!/bin/sh

print_workspaces (){
  hyprctl workspaces -j | jq --slurp --compact-output '.[0] | sort_by(.id)'
}

handle (){
  case $1 in
    createworkspacev2\>*) print_workspaces ;;
    destroyworkspacev2\>*) print_workspaces ;;
  esac
}

handle "createworkspacev2>"

nc -U $XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket2.sock - | while read -r line; do
handle "$line"
done
