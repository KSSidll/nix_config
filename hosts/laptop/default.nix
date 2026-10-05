{ pkgs, ... }:
{
  imports = [
    /etc/nixos/hardware-configuration.nix
    ../../modules/profiles/desktop
    ./kanata.nix
    ./power.nix
  ];

  boot.initrd.kernelModules = [ "amdgpu" ];
  environment.systemPackages = [ pkgs.amdgpu_top ];

  niri.outputs."eDP-1".scale = 1.5;

  zenBrowser.hardwareAv1 = false;

  systemOverlay.widgets = {
    battery = true;
    bluetooth = true;
    powerProfiles = true;
  };
}
