#!/bin/sh

print_workspaces (){
  hyprctl activeworkspace -j | jq --slurp --compact-output '.[0]'
}

handle (){
  case $1 in
    workspacev2\>*) print_workspaces ;;
    focusedmon\>*) print_workspaces ;;
  esac
}

handle "focusedmon>"

nc -U $XDG_RUNTIME_DIR/hypr/$HYPRLAND_INSTANCE_SIGNATURE/.socket2.sock - | while read -r line; do
handle "$line"
done
