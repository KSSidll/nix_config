
{ pkgs, vars, ... }:
{
  imports = [
    ../../dunst
    ../../rofi
    ../../swaylock
  ];

  programs.niri = {
    enable = true;
  };

  environment = {
    systemPackages = with pkgs; [
      # catppuccin-sddm
      wl-clipboard-rs
    ];
  };

  programs.dconf.enable = true;

  environment = {
    sessionVariables = {
      NIXOS_OZONE_WL = "1";
      WLR_NO_HARDWARE_CURSORS = "1";
    };
  };

  home-manager.users.${vars.user} = {
    home = {
      file = {
        ".config/niri".source = ./niri;
      };
    };
  };
}
