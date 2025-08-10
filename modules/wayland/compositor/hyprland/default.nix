{ self, system, pkgs, vars, ags, ... }:
let
  ags-system-overlay = ags.lib.bundle {
    pkgs = pkgs;
    src = ./ags;
    name = "system-overlay";
    entry = "app.ts";
    gtk4 = true;
    extraPackages = with ags.packages.${system}; [
      io
      gjs
      tray
      apps
      notifd
      astal4
      wireplumber
      network
      hyprland
      bluetooth
      battery
    ];
  };
in
{
  imports = [
    ../../dunst
    ../../rofi
    ../../swaylock
  ];

  programs.hyprland = {
    enable = true;
    withUWSM = true;
    xwayland.enable = true;
  };

  environment = {
    systemPackages = with pkgs; [
      # catppuccin-sddm
      hyprpaper
      hyprshot
      wl-clipboard-rs
    ] ++ [
      ags-system-overlay # ags system overlay built from ./ags
    ] ++ (with ags.packages.${system}; [
      io
      battery
      hyprland
      notifd
    ]);
  };

  fonts.packages = with pkgs; [ # fonts that system overlay uses
    geist-font
  ];

  services.upower.enable = true; # DBus service that provides power management support, used by ags-system-overlay

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
        ".config/hypr".source = ./hypr;
      };
    };
  };
}
