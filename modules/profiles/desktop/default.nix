{ ... }:
{
  # Warsaw
  nightLight = {
    enable = true;
    latitude = 52.23;
    longitude = 21.01;
  };

  imports = [
    ../../apps
    ../../dev
    ../../virtualisation
    ../../wayland/compositor/niri
    ../../theme/catppuccin/mocha-lavender
    ../../terminal/ghostty
    ../../editor/neovim
    ../../shell/zsh
    ../../browser/zen-browser
  ];
}
