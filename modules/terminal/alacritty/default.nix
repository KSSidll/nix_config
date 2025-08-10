{ pkgs, vars, ... }:
{
  environment = {
    variables = {
      TERMINAL = "alacritty";
    };

    systemPackages = with pkgs; [
      alacritty
    ];
  };

  fonts.packages = with pkgs; [
      nerd-fonts.hack
  ];

  home-manager.users.${vars.user} = {
    home.file = {
      ".config/alacritty".source = ./alacritty;
    };
  };
}
