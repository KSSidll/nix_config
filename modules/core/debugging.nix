{ config, pkgs, vars, ... }:
{
  # the package changes of every switch, listed while it activates; `nvd diff` compares any two kept generations later
  system.activationScripts.generationDiff = {
    supportsDryActivation = true;
    text = ''
      if [[ -e /run/current-system ]]; then
        ${pkgs.nvd}/bin/nvd --nix-bin-dir=${config.nix.package}/bin diff /run/current-system "$systemConfig"
      fi
    '';
  };

  # debug symbols for gdb and `coredumpctl debug`, fetched on demand for packages that keep separate debug info
  services.nixseparatedebuginfod2.enable = true;
  # gdb otherwise asks in every session whether to use it
  environment.etc."gdb/gdbinit.d/debuginfod.gdb".text = ''
    set debuginfod enabled on
  '';

  services.smartd = {
    enable = true;
    # any local user can send these notifications, which on a single-user machine is only the user
    notifications.systembus-notify.enable = true;
  };

  programs.mtr.enable = true;
  programs.tcpdump.enable = true;
  programs.bcc.enable = true;
  users.users.${vars.user}.extraGroups = [ "pcap" ];

  environment.systemPackages = with pkgs; [
    nvd
    gdb
    pciutils
    usbutils
    lsof
    lm_sensors
    smartmontools
    dnsutils
    powertop
    wev
    d-spy
    qpwgraph
  ];
}
