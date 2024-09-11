{ pkgs-unstable, vars, ... }:
{
  environment = {
    systemPackages = with pkgs-unstable; [
      (wrapFirefox
        (floorp-unwrapped.overrideAttrs (old: {
          configureFlags = (old.configureFlags or [ ]) ++ [
            "--enable-private-components"
          ];
          }))
      { })
    ];
  };

  home-manager.users.${vars.user} = {
    home.file = {
      ".floorp/profiles.ini".source = ./profiles.ini;
      ".floorp/j9kexz06.arken/user.js".source = ./arken-user.js;
    };
  };
}
