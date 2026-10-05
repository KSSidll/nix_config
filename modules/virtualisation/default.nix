{ pkgs, lib, vars, ... }:
{
  # rootless, so files containers write into bind-mounted sources stay the user's, and container traffic leaves through
  # slirp4netns as an ordinary process that Portmaster and the firewall see; rootful traffic is forwarded past both
  virtualisation.docker.rootless = {
    enable = true;
    setSocketVariable = true;
    # Docker's default pools reach into 192.168.0.0/16 after about fifteen networks, where LAN and VPN routes live
    daemon.settings.default-address-pools = [
      {
        base = "172.16.0.0/12";
        size = 24;
      }
    ];
  };
  # the module only excludes root, so the display manager's user manager starts the daemon too, and it fails there for
  # lack of a subuid range
  systemd.user.services.docker.unitConfig.ConditionUser = lib.mkForce vars.user;

  # VMs run in the user's libvirt session; the system module is here for QEMU and its firmware at stable paths, which
  # session VM definitions record, and its own daemon exits when idle
  virtualisation.libvirtd.enable = true;
  virtualisation.spiceUSBRedirection.enable = true;
  programs.virt-manager.enable = true;

  environment.systemPackages = with pkgs; [
    # the session's emulated TPM, which Windows 11 requires
    swtpm
    lazydocker
  ];

  home-manager.users.${vars.user}.dconf.settings."org/virt-manager/virt-manager/connections" = {
    uris = [ "qemu:///session" ];
    autoconnect = [ "qemu:///session" ];
  };
}
