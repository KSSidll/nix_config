{ pkgs, vars, ... }:
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

  # SSH
  services.openssh = {
    enable = true;
    ports = [ 22 ];
    settings = {
      PasswordAuthentication = true;
      AllowUsers = null;
      UseDns = true;
      X11Forwarding = false;
      PermitRootLogin = "prohibit-password";
    };
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
    geist-font
  ];

  networking = {
    networkmanager = {
      enable = true;

      plugins = with pkgs; [
        networkmanager-openvpn
      ];
    };

    firewall = {
      enable = true;

      allowedUDPPorts = [
        53317
      ];

      allowedTCPPorts = [
        53317
        22
      ];
    };
  };

  programs.openvpn3.enable = true;

  environment = {
    variables = {
      GCM_CREDENTIAL_STORE = "cache";
    };
    systemPackages = with pkgs; [
      virtio-win # virtualisation
      spice-gtk # virtualisation
      gnome-boxes # virtualisation
      nautilus # file manager
      neovim # editor
      git
      git-credential-manager
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
      vesktop # Vencord discord
      obs-studio
      android-studio
      jetbrains.pycharm-oss
      tmux
      python314
      uv # Python manager / resolver
      zed-editor
      nixd
      nil
    ];
  };

  services.gvfs.enable = true; # gnome virtual file system for nautilus file manager

  services = {
    printing.enable = true;
    # pulseaudio.enable = true;

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

    imports = [
      "${fetchTarball "https://github.com/msteen/nixos-vscode-server/tarball/master"}/modules/vscode-server/home.nix"
    ];

    services.vscode-server.enable = true;

    programs = {
      home-manager.enable = true;
    };
  };
}
