{ pkgs, vars, ... }:
{
  environment = {
    systemPackages = with pkgs; [
      swaylock-effects
    ];
  };

  home-manager.users.${vars.user} = {
    home.file = {
      ".config/swaylock".source = ./swaylock;
    };
  };
}
