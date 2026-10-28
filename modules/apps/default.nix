{ pkgs, ... }:
{
  imports = [ ./files.nix ./defaults.nix ./keepassxc ];

  programs.localsend = {
    enable = true;
    openFirewall = true;
  };

  environment.systemPackages = with pkgs; [
    pavucontrol
    vesktop
  ];
}
