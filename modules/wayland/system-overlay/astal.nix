# The GObject libraries the overlay uses, shared by its package and the ags dev shell so both run the same patched builds
{ pkgs, agsPkgs }:
let
  network = agsPkgs.network.overrideAttrs (old: {
    patches = (old.patches or [ ]) ++ [ ./patches/astal-network-active-access-point.patch ];
  });

  libraries = [ network ] ++ (with agsPkgs; [
    io
    tray
    apps
    notifd
    astal4
    wireplumber
    bluetooth
    battery
    powerprofiles
    mpris
  ]) ++ [ pkgs.polkit.out ];
in
{
  inherit libraries;

  ags = agsPkgs.agsFull.override { extraPackages = libraries ++ [ pkgs.libadwaita ]; };
}
