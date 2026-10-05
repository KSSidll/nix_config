{ pkgs, ... }:
{
  imports = [
    ./audio.nix
    ./boot.nix
    ./debugging.nix
    ./git.nix
    ./home-manager.nix
    ./locale.nix
    ./networking.nix
    ./portmaster.nix
    ./printing.nix
    ./nix.nix
    ./ssh.nix
    ./syncthing.nix
    ./users.nix
  ];

  security.polkit.enable = true;

  services.fwupd.enable = true;

  environment.systemPackages = with pkgs; [
    git
    wget
    tree
    btop
    killall
    zip
    unzip
    nix-tree
  ];

  system.stateVersion = "24.05";
}
