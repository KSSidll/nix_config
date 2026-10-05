{ pkgs, vars, theme, ... }:
let
  c = theme.colors;
in
{
  security.pam.services.swaylock = { };

  home-manager.users.${vars.user}.programs.swaylock = {
    enable = true;
    package = pkgs.swaylock-effects;
    settings = {
      daemonize = true;
      show-failed-attempts = true;
      clock = true;
      screenshots = true;
      effect-blur = "9x5";
      color = "${c.base}80";
      font = theme.fonts.sans.name;
      indicator = true;
      indicator-radius = 200;
      indicator-thickness = 20;
      line-color = c.base;
      ring-color = c.crust;
      inside-color = c.base;
      key-hl-color = c.${theme.accent};
      separator-color = "00000000";
      text-color = c.text;
      line-ver-color = c.${theme.accent};
      ring-ver-color = c.${theme.accent};
      inside-ver-color = c.base;
      text-ver-color = c.text;
      ring-wrong-color = c.red;
      text-wrong-color = c.red;
      inside-wrong-color = c.base;
      inside-clear-color = c.base;
      text-clear-color = c.text;
      ring-clear-color = c.teal;
      line-clear-color = c.base;
      line-wrong-color = c.base;
      bs-hl-color = c.red;
      grace-no-mouse = true;
      grace-no-touch = true;
      datestr = "%d.%m";
      ignore-empty-password = true;
    };
  };
}
