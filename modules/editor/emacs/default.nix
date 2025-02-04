{ pkgs, vars, ... }:
{
  environment = {
    systemPackages = with pkgs; [
      emacs
    ];
  };

  home-manager.users.${vars.user} = {
    home.file = {
      ".emacs.d/init.el".source = ./emacs.d/init.el;
    };
  };
}
