{ pkgs, vars, ... }:
{
  networking = {
    networkmanager = {
      enable = true;
      plugins = [ pkgs.networkmanager-openvpn ];
    };
    firewall.enable = true;
  };

  users.users.${vars.user}.extraGroups = [ "networkmanager" ];
}
