{ pkgs, vars, ... }:
{
  environment = {
    systemPackages = with pkgs; [
      firefox
    ];
  };

  home-manager.users.${vars.user} = {
    home.file = {
      ".mozilla/firefox/profiles.ini".source = ./profiles.ini;
      ".mozilla/firefox/j9kexz06.arken/user.js".source = ./user.js;
      ".mozilla/firefox/j9kexz06.arken/chrome".source = ./chrome;
    };
  };
}
