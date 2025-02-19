{ self, system, pkgs, pkgs-unstable, vars, ags, ... }:
let
  ags-system-overlay = ags.lib.bundle {
    pkgs = pkgs-unstable;
    src = ./ags;
    name = "system-overlay";
    entry = "app.ts";
    gtk4 = true;
    extraPackages = with ags.packages.${system}; [
        hyprland
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
      # waybar
      eww
      wl-clipboard-rs
      jq # tool to work with json, used for widgets
    ] ++ [
      ags-system-overlay # ags system overlay built from ./ags
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
        ".config/hypr".source = ./hypr;
        # ".config/waybar".source = ./waybar;
        ".config/eww".source = ./eww;
      };
    };
  };
}
