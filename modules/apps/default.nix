{ pkgs, ... }:
{
  imports = [ ./files.nix ./defaults.nix ];

  programs.localsend = {
    enable = true;
    openFirewall = true;
  };

  environment.systemPackages = with pkgs; [
    keepassxc
    pavucontrol
    vesktop
  ];
}
