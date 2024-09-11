{ pkgs, vars, ... }:
{
  imports = [
    ../../dunst
    ../../rofi
    ../../swaylock
  ];
  
  programs.hyprland = {
    enable = true;
    xwayland.enable = true;
  };

  # services.displayManager.sddm = {
  #   enable = true;
  #   wayland.enable = true;
  #   theme = "catppuccin-mocha";
  # };

  environment = {
    systemPackages = with pkgs; [
      # catppuccin-sddm
      hyprpaper
      hyprshot
      # waybar
      eww
      wl-clipboard-rs
      jq # tool to work with json, used for widgets
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
