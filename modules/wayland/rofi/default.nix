{ pkgs, vars, ... }:
{
  environment = {
    systemPackages = with pkgs; [
      rofi-wayland
    ];
  };

  home-manager.users.${vars.user} = {
    home.file = {
      ".config/rofi".source = ./rofi;
    };
  };
}
