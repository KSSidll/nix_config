{ pkgs, vars, ... }:
{
  environment = {
    systemPackages = with pkgs; [
      dunst
    ];
  };

  home-manager.users.${vars.user} = {
    home.file = {
      ".config/dunst".source = ./dunst;
    };
  };
}
