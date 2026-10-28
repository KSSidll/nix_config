{ config, pkgs, lib, inputs, vars, ... }:
let
  # the module is only in unstable; drop this import once the stable channel ships it
  portmasterPath = "${inputs.nixpkgs-unstable}/nixos/modules/services/networking/portmaster.nix";
  portmasterModule = import portmasterPath;

  # its manual chapter fails the stable manual build, whose redirects file doesn't list the chapter's ids
  withoutManualChapter = lib.setFunctionArgs
    (args: let m = portmasterModule args; in m // { meta = removeAttrs m.meta [ "doc" ]; })
    (lib.functionArgs portmasterModule);

  # the nscd module runs pkgs.nsncd directly; services.nscd.package is glibc's nscd, used only without nsncd
  nscdExecutable =
    if config.services.nscd.enableNsncd then "${pkgs.nsncd}/bin/nsncd" else "${config.services.nscd.package}/bin/nscd";

  # routed directly instead of through SPN
  spnExcluded = [
    ".whatsapp.com"
    ".whatsapp.net"
    ".reddit.com"
    ".youtube.com"
    ".claude.com"
    ".anthropic.com"
    ".google.com"
    ".googleapis.com"
    ".googlevideo.com"
    ".googleusercontent.com"
    ".x-kom.pl"
    ".allegro.pl"
    ".allegroimg.com"
    ".amazonaws.com"
    ".amazontrust.com"
    ".sharepoint.com"
    ".office.com"
    ".office.net"
    ".claude.ai"
    ".xtb.com"
    ".x-station.eu"
    ".deviantart.com"
    ".ovhcloud.com"
    ".ovh.net"
    ".ovh.com"
    ".ovh.pl"
    ".umaiclothing.com"
    ".ms.gov.pl"
    ".impervadns.net"
    ".socialblade.com"
    ".alicdn.com"
    ".aliexpress.com"
    ".zoho.com"
    ".zoho.eu"
    ".wcdnga.com"
    ".jaststore.com"
    ".stripe.com"
  ];
in
{
  imports = [
    {
      _file = portmasterPath;
      imports = [ withoutManualChapter ];
    }
  ];

  services.portmaster = {
    enable = true;
    # Portmaster recognises the system resolver only at FHS paths, and only that resolver's answers map an IP back to
    # its domain for every app; apps resolve through nscd, so without this their connections carry no domain and
    # domain rules, such as the SPN exclusions below, never match them
    package = pkgs.unstable.portmaster.overrideAttrs (old: {
      postPatch = (old.postPatch or "") + ''
        substituteInPlace service/process/profile.go \
          --replace-fail '"/usr/sbin/nscd",' '"/usr/sbin/nscd", "${nscdExecutable}",'
      '';
    });

    settings = {
      core.expertiseLevel = "expert";

      dns = {
        nameservers = [
          "dot://dot1.applied-privacy.net?ip=146.255.56.98&name=AppliedPrivacy"
          "dot://cloudflare-dns.com?ip=1.1.1.1&name=Cloudflare&blockedif=zeroip"
          "dot://cloudflare-dns.com?ip=1.0.0.1&name=Cloudflare&blockedif=zeroip"
        ];
        useStaleCache = true;
      };

      filter = {
        blockInbound = true;
        endpoints = [ "+ redsopedia.reds.com.pl" ];
        serviceEndpoints = [ "+ redsopedia.reds.com.pl" ];
        includeCNAMEs = true;
        lists = [ "TRAC" "MAL" "DECEP" "BAD" "UNBREAK" ];
        preventBypassing = true;
      };

      history = {
        enable = true;
        keep = 30;
      };

      splittun.enable = false;

      spn = {
        enable = true;
        usagePolicy = map (domain: "- ${domain} */HTTPS") spnExcluded;
      };
    };

    profiles =
      let
        noSpn.spn.use = false;
        # LAN peers connect in directly, which global blockInbound and SPN routing would break
        lanPeer = lib.recursiveUpdate noSpn { filter.blockInbound = false; };
      in
      {
        Syncthing = {
          packages = [ config.services.syncthing.package ];
          settings = lanPeer;
        };

        LocalSend = {
          packages = [
            {
              package = config.programs.localsend.package;
              directory = "app/localsend";
              name = "localsend_app";
            }
          ];
          settings = lanPeer;
        };

        # the tunnel itself; VPN servers often accept only known addresses, and the traffic inside is already private
        OpenVPN = {
          packages = [ pkgs.openvpn ];
          settings = noSpn;
        };

        # mDNS answers arrive as multicast Portmaster can't match to the question, so they count as inbound
        Avahi = {
          packages = [
            {
              package = config.services.avahi.package;
              name = "avahi-daemon";
            }
          ];
          settings.filter = {
            blockInbound = false;
            serviceEndpoints = [ "+ LAN UDP/5353" "- *" ];
          };
        };

        # bin/nix is also nix-daemon, so this covers store downloads as well as the CLI
        Nix = {
          packages = [ config.nix.package ];
          settings = noSpn;
        };

        # debug symbols come from the binary cache, like the Nix profile's downloads
        "Debug symbols" = lib.mkIf config.services.nixseparatedebuginfod2.enable {
          packages = [ config.services.nixseparatedebuginfod2.package ];
          settings = noSpn;
        };

        # containers reach the network through slirp4netns, while the daemon and the buildx plugin, which run at
        # store paths of their own rather than the docker package's, connect out themselves
        Docker = lib.mkIf config.virtualisation.docker.rootless.enable {
          packages = [
            pkgs.slirp4netns
            {
              package = config.virtualisation.docker.rootless.package.moby;
              directory = "libexec/docker";
              name = "dockerd";
            }
            {
              package = pkgs.docker-buildx;
              directory = "libexec/docker/cli-plugins";
              name = "docker-buildx";
            }
          ];
          settings = noSpn;
        };

        # session VMs reach the network through QEMU's own user-mode stack
        QEMU = lib.mkIf config.virtualisation.libvirtd.enable {
          packages = [
            {
              package = config.virtualisation.libvirtd.qemu.package;
              directory = "bin";
              name = null;
              strictLast = false;
            }
          ];
          settings = noSpn;
        };

        # every daemon under lib/systemd (timesyncd, resolved, …)
        systemd = {
          packages = [
            {
              package = config.systemd.package;
              directory = "lib/systemd";
              name = null;
              strictLast = false;
            }
          ];
          settings = noSpn;
        };
      };
  };

  # the package's autostart entry starts the same tray as portmaster-ui, and whichever comes up second exits; a user
  # entry of the same name hides it
  home-manager.users.${vars.user}.xdg.configFile."autostart/portmaster.desktop".text = ''
    [Desktop Entry]
    Hidden=true
  '';

  systemd.user.services.portmaster-ui = {
    description = "Portmaster tray";
    wantedBy = [ "graphical-session.target" ];
    partOf = [ "graphical-session.target" ];
    after = [ "graphical-session.target" ];
    serviceConfig = {
      ExecStart = "${config.services.portmaster.package}/bin/portmaster --background";
      Restart = "on-failure";
    };
  };
}
