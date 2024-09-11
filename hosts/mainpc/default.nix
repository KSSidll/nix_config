{ pkgs, pkgs-unstable, ... }:
{
  imports = [
    ./hardware-configuration.nix
    ../../modules/wayland/compositor/hyprland
    ../../modules/theme/catppuccin/mocha-lavender
    ../../modules/terminal/alacritty
    ../../modules/editor/neovim
    ../../modules/shell/zsh
    ../../modules/browser/firefox
  ];

  # Boot Options
  boot = {
    loader = {
      systemd-boot = {
        enable = true;
	configurationLimit = 5;
      };

      efi = {
        canTouchEfiVariables = true;
      };

      timeout = 2;
    };
  };

  environment = {
    systemPackages = with pkgs; [
      discord
      betterdiscordctl
      obs-studio
      android-studio
      localsend
    ];
  };
}
