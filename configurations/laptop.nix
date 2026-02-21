args@{ pkgs, ... }:
let
  vars = args.vars // {

  };
in {
  imports = [
    /etc/nixos/hardware-configuration.nix
    ../modules/wayland/compositor/hyprland
    ../modules/wayland/compositor/niri
    ../modules/theme/catppuccin/mocha-lavender
    ../modules/terminal/alacritty
    ../modules/editor/neovim
    ../modules/editor/emacs
    ../modules/shell/zsh
    ../modules/browser/firefox
    ../modules/browser/zen-browser
    ../modules/keyboard/kanata
  ];

  environment = {
    systemPackages = with pkgs; [
      vscode-fhs
    ];
  };
}
