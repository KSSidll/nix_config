{ config, pkgs, lib, vars, ... }:
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

  systemd.user =
    let
      # the system module's autoPrune only reaches the rootful daemon; volumes are left alone, since they hold the data
      # of compose stacks, which no filter can tell from abandoned ones
      prune = { schedule, flags, description }: {
        services."docker-prune-${schedule}" = {
          inherit description;
          requires = [ "docker.service" ];
          after = [ "docker.service" ];
          environment.DOCKER_HOST = "unix://%t/docker.sock";
          unitConfig.ConditionUser = vars.user;
          serviceConfig = {
            Type = "oneshot";
            ExecStart = "${config.virtualisation.docker.rootless.package}/bin/docker system prune --force ${flags}";
          };
        };
        timers."docker-prune-${schedule}" = {
          wantedBy = [ "timers.target" ];
          timerConfig = {
            OnCalendar = schedule;
            Persistent = true;
          };
        };
      };
    in
    lib.mkMerge [
      # the module only excludes root, so the display manager's user manager starts the daemon too, and it fails there
      # for lack of a subuid range
      { services.docker.unitConfig.ConditionUser = lib.mkForce vars.user; }

      # what a day of test runs leaves: stopped containers, unused networks, untagged images and dangling build cache
      (prune {
        schedule = "daily";
        flags = "--filter until=24h";
        description = "Remove Docker leftovers older than a day";
      })
      # every image no container uses and all build cache, sparing the last week's so test runs don't start cold
      (prune {
        schedule = "weekly";
        flags = "--all --filter until=168h";
        description = "Remove unused Docker images and build cache older than a week";
      })
    ];

  # VMs run in the user's libvirt session; the system module is here for QEMU and its firmware at stable paths, which
  # session VM definitions record, and its own daemon exits when idle
  virtualisation.libvirtd.enable = true;
  virtualisation.spiceUSBRedirection.enable = true;
  programs.virt-manager.enable = true;

  environment.systemPackages = with pkgs; [
    # the session's emulated TPM, which Windows 11 requires
    swtpm
    lazydocker
    # through the docker CLI, the only place that knows where its store-path plugins are: standalone Compose doesn't
    # find buildx and falls back to the legacy builder, which can't build Dockerfiles using BuildKit syntax
    (pkgs.writeShellScriptBin "docker-compose" ''
      exec ${config.virtualisation.docker.rootless.package}/bin/docker compose "$@"
    '')
  ];

  home-manager.users.${vars.user}.dconf.settings."org/virt-manager/virt-manager/connections" = {
    uris = [ "qemu:///session" ];
    autoconnect = [ "qemu:///session" ];
  };
}
