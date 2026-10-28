{ config, lib, pkgs, inputs, vars, theme, ... }:
let
  cfg = config.systemOverlay;
  hm = config.home-manager.users.${vars.user};
  agsPkgs = inputs.ags.packages.${pkgs.stdenv.hostPlatform.system};
  astal = import ./astal.nix { inherit pkgs agsPkgs; };

  generated = pkgs.linkFarm "system-overlay-generated" {
    "theme.scss" = pkgs.writeText "theme.scss" (
      lib.concatStrings (lib.mapAttrsToList (name: hex: "\$${name}: #${hex};\n") theme.colors)
      + "\$accent: \$${theme.accent};\n"
      + "\$font-sans: \"${theme.fonts.sans.name}\";\n"
      + lib.concatStrings (lib.mapAttrsToList (name: px: "\$${name}: ${toString px}px;\n") theme.geometry)
    );
    "config.json" = (pkgs.formats.json { }).generate "config.json" {
      inherit (cfg) widgets;
      idle = config.idle.settings;
      inherit (config.idle) sleep;
      settings = {
        defaults = cfg.settings;
        inherit (cfg) overrides;
      };
      inherit (cfg) recordings launcher;
      battery.sleepsAt = config.services.upower.percentageAction;
      nightLight = config.nightLight.enable;
      syncthing = if config.services.syncthing.enable then {
        address = "http://${config.services.syncthing.guiAddress}";
        # read at runtime for the API key, which stays out of the store
        config = "${config.services.syncthing.configDir}/config.xml";
      } else null;
      inherit (theme) geometry;
    };
  };

  # nm-connection-editor, opened from the network panel, without the applet: the overlay is the network UI and the
  # secret agent, and the package's autostart entry would start the applet as a second agent with its own tray icon
  connectionEditor = pkgs.runCommand "nm-connection-editor" { } ''
    cp -rs ${pkgs.networkmanagerapplet} $out
    chmod -R u+w $out
    rm -r $out/etc/xdg/autostart $out/bin/nm-applet $out/share/applications/nm-applet.desktop
  '';

  package = pkgs.stdenv.mkDerivation {
    name = "system-overlay";
    src = ./src;

    nativeBuildInputs = with pkgs; [
      wrapGAppsHook3
      gobject-introspection
      agsPkgs.default
    ];

    buildInputs = astal.libraries ++ [ pkgs.gjs ];

    installPhase = ''
      runHook preInstall

      cp -r ${generated} generated
      mkdir -p $out/bin
      ags bundle app.tsx --gtk 4 $out/bin/system-overlay

      runHook postInstall
    '';
  };
in
{
  options.systemOverlay = {
    widgets = {
      battery = lib.mkEnableOption "the battery widget";
      bluetooth = lib.mkEnableOption "the Bluetooth tile, and Bluetooth itself";
      powerProfiles = lib.mkEnableOption "the power mode tile, and power-profiles-daemon";
    };

    settings = {
      nightLight = lib.mkOption {
        type = lib.types.bool;
        default = true;
        description = "Whether night light warms the screen between sunset and sunrise, where it is enabled.";
      };

      bluetoothVisible = lib.mkOption {
        type = lib.types.bool;
        default = true;
        description = "Whether nearby Bluetooth devices can see this machine while the Bluetooth page is open.";
      };

      displays = lib.mkOption {
        type = with lib.types; attrsOf (enum [ "extend" "mirror" "off" ]);
        default = { };
        example = { "PNP(AOC) 27G4 2O5R2HA015276" = "extend"; };
        description = ''
          How each external display is used, by make, model and serial as niri reports them. On a machine with a built-in
          panel, the overlay asks about displays not listed when they connect.
        '';
      };
    };

    recordings = lib.mkOption {
      type = lib.types.str;
      default = "${hm.home.homeDirectory}/Videos/Recordings";
      description = "Where screen recordings started from the overlay are saved.";
    };

    launcher = lib.mkOption {
      type = lib.types.nullOr (lib.types.submodule {
        options = {
          namespace = lib.mkOption {
            type = lib.types.str;
            description = "The layer-shell namespace of the launcher's window.";
          };
          open = lib.mkOption {
            type = with lib.types; listOf str;
            description = "The command that opens the launcher.";
          };
          close = lib.mkOption {
            type = with lib.types; listOf str;
            description = "The command that closes the launcher.";
          };
        };
      });
      default = null;
      description = ''
        A layer-shell launcher the overlay opens and closes for the `launcher` request, dimming the screen behind it
        while it is open. It has to sit on a layer above the overlay's top layer.
      '';
    };

    overrides = lib.mkOption {
      type = lib.types.str;
      default = "${hm.xdg.stateHome}/system-overlay/overrides.json";
      readOnly = true;
      description = ''
        Runtime overrides of the settings, written when they are changed from the overlay and read over these defaults.
        Deleting the file restores them.
      '';
    };

    generated = lib.mkOption {
      type = lib.types.package;
      default = generated;
      readOnly = true;
      internal = true;
      description = "Nix-generated theme and widget config, linked into the source tree by dev.sh.";
    };
  };

  config = {
    environment.systemPackages = [
      connectionEditor
      pkgs.wf-recorder
      pkgs.slurp
      pkgs.wl-mirror
      # a screenshot notification's Annotate
      pkgs.satty
    ];

    home-manager.users.${vars.user} = {
      # Enter saves the annotated screenshot over its file, copies it and closes; wl-copy keeps serving the clipboard
      # after satty exits
      xdg.configFile."satty/config.toml".source = (pkgs.formats.toml { }).generate "satty.toml" {
        general = {
          early-exit = true;
          copy-command = "${pkgs.wl-clipboard}/bin/wl-copy";
          actions-on-enter = [ "save-to-file" "save-to-clipboard" ];
          actions-on-escape = [ "exit" ];
        };
        font.family = theme.fonts.sans.name;
      };

      systemd.user.services = {
        system-overlay = {
          Unit = {
            Description = "System overlay";
            PartOf = [ "graphical-session.target" ];
            After = [ "graphical-session.target" ];
          };
          Service = {
            ExecStart = "${package}/bin/system-overlay";
            Restart = "on-failure";
            # started once the tray's host is up: apps that check for a tray only when they start, like KeePassXC, are
            # ordered after this
            Type = "dbus";
            BusName = "org.kde.StatusNotifierWatcher";
          };
          Install.WantedBy = [ "graphical-session.target" ];
        };

        # the night light tile starts and stops the service; at login it starts only if the setting has it on
        wlsunset.Service.ExecCondition = lib.mkIf config.nightLight.enable "${pkgs.writeShellScript "night-light-on" ''
          value=$(${pkgs.jq}/bin/jq -r 'if has("nightLight") then .nightLight else empty end' ${cfg.overrides} 2>/dev/null)
          [ "''${value:-${lib.boolToString cfg.settings.nightLight}}" = true ]
        ''}";
      };
    };

    services.upower = {
      enable = cfg.widgets.battery;
      # the battery warnings follow these levels, and at the last one the system sleeps by itself
      percentageLow = 20;
      percentageCritical = 7;
      percentageAction = 3;
    };
    hardware.bluetooth.enable = cfg.widgets.bluetooth;
    services.power-profiles-daemon.enable = cfg.widgets.powerProfiles;
  };
}
