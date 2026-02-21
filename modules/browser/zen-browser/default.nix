{ pkgs, vars, inputs, ... }:
let
  zen-browser = inputs.zen-browser;
in {
  environment = {
    systemPackages = [
        zen-browser.packages.${pkgs.stdenv.hostPlatform.system}.default
    ];
  };

  home-manager.users.${vars.user} = {
    home.file = {
      ".config/zen/profiles.ini".source = ./profiles.ini;
      ".config/zen/j9kexz06.arken/user.js".source = ./user.js;
    };
  };
}
