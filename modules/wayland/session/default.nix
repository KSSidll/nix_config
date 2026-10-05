{ pkgs, theme, ... }:
{
  imports = [
    ../vicinae
    ../swaylock
  ];

  programs.dconf.enable = true;

  boot = {
    plymouth = {
      enable = true;
      theme = "catppuccin-${theme.flavor}";
      themePackages = [
        (pkgs.catppuccin-plymouth.override { variant = theme.flavor; })
      ];
    };

    consoleLogLevel = 3;
    initrd.verbose = false;
    kernelParams = [
      "quiet"
      "udev.log_level=3"
      "systemd.show_status=auto"
    ];
  };

  services.displayManager.sddm = {
    enable = true;
    wayland = {
      enable = true;
      compositor = "kwin";
    };
    theme = "catppuccin-${theme.flavor}-${theme.accent}";
    settings.Theme = {
      CursorTheme = theme.cursor.name;
      CursorSize = theme.cursor.size;
    };
  };

  environment = {
    sessionVariables.NIXOS_OZONE_WL = "1";

    systemPackages = with pkgs; [
      wl-clipboard-rs
      (catppuccin-sddm.override { inherit (theme) flavor accent; })
      theme.cursor.package # the greeter runs as the sddm user, outside home-manager
    ];
  };
}
