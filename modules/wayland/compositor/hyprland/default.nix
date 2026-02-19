{ self, system, pkgs, vars, ags, astal, ... }:
let
  ags-system-overlay = pkgs.stdenv.mkDerivation {
    name = "system-overlay";
    src = ./ags;

    nativeBuildInputs = with pkgs; [
      wrapGAppsHook3
      gobject-introspection
      ags.packages.${system}.default
    ];

    buildInputs = with ags.packages.${system}; [
      io
      tray
      apps
      notifd
      astal4
      wireplumber
      network
      hyprland
      bluetooth
      battery
    ] ++ [pkgs.gjs];

    installPhase = ''
      runHook preInstall

      mkdir -p $out/bin
      mkdir -p $out/share
      cp -r * $out/share
      ags bundle app.tsx --gtk 4 $out/bin/system-overlay -d "SRC='$out/share'"

      runHook postInstall
    '';
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
