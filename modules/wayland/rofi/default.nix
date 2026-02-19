{ pkgs, vars, ... }:
{
  environment = {
    systemPackages = with pkgs; [
      rofi
    ];
  };

  home-manager.users.${vars.user} = {
    home.file = {
      ".config/rofi".source = ./rofi;
    };
  };
}
