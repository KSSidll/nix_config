{ pkgs, ... }:
{
  imports = [
    /etc/nixos/hardware-configuration.nix
    ../../modules/wayland/compositor/hyprland
    ../../modules/theme/catppuccin/mocha-lavender
    ../../modules/terminal/alacritty
    ../../modules/editor/neovim
    ../../modules/shell/zsh
    ../../modules/browser/firefox
  ];

  environment = {
    systemPackages = with pkgs; [
      discord
      betterdiscordctl
      obs-studio
      android-studio
    ];
  };
}
