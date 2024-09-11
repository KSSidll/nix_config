{ pkgs, inputs, vars, ... }:
{
  boot = {
    loader = {
      systemd-boot = {
        enable = true;
        configurationLimit = 5;
      };

      efi = {
        canTouchEfiVariables = true;
      };

      timeout = 2;
    };

    tmp = {
      cleanOnBoot = true;
      tmpfsSize = "5GB";
    };
  };

  users.users.${vars.user} = {
    isNormalUser = true;
    extraGroups = [
      "wheel" # sudo
      "input" # for input access
      "uinput" # for input access
      "libvirtd" # virtualisation
      "kvm" # virtualisation
      "networkmanager" # networking
    ];
  };

  # Syncthing
  services.syncthing = {
    enable = true;

    user = vars.user;
    dataDir = "/home/" + vars.user;
    openDefaultPorts = true;
  };

  # Virtualisation
  virtualisation.kvmgt.enable = true;
  virtualisation.libvirtd = {
    enable = true;
    qemu = {
      package = pkgs.qemu_kvm;
      runAsRoot = true;
      swtpm.enable = true;
      ovmf = {
        enable = true;
        packages = [
          (
            pkgs.OVMF.override {
              secureBoot = true;
              tpmSupport = true;
            }
          ).fd
        ];
      };
    };
  };

  # Timezone
  time.timeZone = "Europe/Warsaw";

  # Locale
  i18n = {
    defaultLocale = "en_US.UTF-8";
  };

  # Console
  console = {
    font = "Lat2-Terminus16";
    keyMap = "us";
  };

  # Security
  security = {
    rtkit.enable = true;
    polkit.enable = true;
  };

  # Fonts
  fonts.packages = with pkgs; [
    jetbrains-mono
    font-awesome
    noto-fonts
  ];

  networking = {
    networkmanager = {
      enable = true;

      plugins = with pkgs; [
        gnome.networkmanager-openvpn
      ];
    };

    firewall = {
      enable = true;

      allowedUDPPorts = [
        53317
      ];

      allowedTCPPorts = [
        53317
      ];
    };
  };

  programs.openvpn3.enable = true;

  environment = {
    systemPackages = with pkgs; [
      virtio-win # virtualisation
      spice-gtk # virtualisation
      gnome.gnome-boxes # virtualisation
      gnome.nautilus # file manager
      # zed-editor # editor
      neovim # editor
      git
      wget
      tree
      btop
      killall
      keepassxc # passwords
      gimp # image edition
      nix-tree # Browse Nix store
      pavucontrol # Audio Control
      qpwgraph # Pipewire Graph Manager
      zip
      unzip
      localsend # Send files and data locally
    ];
  };

  services.gvfs.enable = true; # gnome virtual file system for nautilus file manager

  hardware.pulseaudio.enable = false;

  services = {
    printing.enable = true;

    pipewire = {
      enable = true;
        alsa = {
          enable = true;
            support32Bit = true;
        };
      pulse.enable = true;
      jack.enable = true;
    };
  };

  nix = {
    settings = {
      auto-optimise-store = true;
    };

    gc = {
      automatic = true;
      dates = "weekly";
    };

    extraOptions = ''
      experimental-features = nix-command flakes
      '';
  };

  system = {
    stateVersion = "24.05";
  };

  home-manager.users.${vars.user} = {
    home = {
      stateVersion = "24.05";
    };

    programs = {
      home-manager.enable = true;
    };
  };
}
