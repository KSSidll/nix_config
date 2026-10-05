{ config, lib, pkgs, vars, ... }:
let
  cfg = config.idle;
  hm = config.home-manager.users.${vars.user};

  # hypridle has no disabled listener, so "never" is a timeout no session reaches; ext-idle-notify takes milliseconds
  # as a 32-bit value, which caps timeouts at about 49 days
  never = 4000000;
  seconds = minutes: if minutes == null then never else minutes * 60;

  timeout = description: default: lib.mkOption {
    type = with lib.types; nullOr ints.positive;
    inherit default;
    description = "Minutes idle before ${description}, or null for never.";
  };

  # without UPower, as on machines with no battery, this suspends only when told to on AC as well
  suspend = pkgs.writeShellScript "idle-suspend" ''
    if [ "$1" != 1 ]; then
      on_battery=$(${pkgs.systemd}/bin/busctl --system get-property \
        org.freedesktop.UPower /org/freedesktop/UPower org.freedesktop.UPower OnBattery 2>/dev/null)
      [ "$on_battery" = "b true" ] || exit 0
    fi
    exec ${pkgs.systemd}/bin/systemctl ${cfg.sleep}
  '';

  brightnessctl = "${pkgs.brightnessctl}/bin/brightnessctl";
  loginctl = "${pkgs.systemd}/bin/loginctl";

in
{
  options.idle = {
    dim = timeout "dimming the screen" 8;
    lock = timeout "locking" 10;
    screenOff = timeout "turning the screens off" 11;
    suspend = timeout "suspending" 15;
    suspendOnAC = lib.mkEnableOption "suspending on idle while on AC power";

    sleep = lib.mkOption {
      type = lib.types.enum [ "suspend" "hybrid-sleep" "hibernate" ];
      default = "suspend";
      description = ''
        The systemctl verb for every suspend: the lid, idle and the system overlay's button. hybrid-sleep saves memory
        to swap first, so a battery that runs out while suspended costs a restore from swap instead of the session, but
        every sleep then starts with a save of tens of seconds that reopening the lid doesn't interrupt.
        suspend-then-hibernate isn't offered: it relies on the RTC waking the machine from suspend, which some
        platforms can't do, and there it hibernates when the lid opens.
      '';
    };

    screenOffCommand = lib.mkOption {
      type = lib.types.str;
      description = "The compositor's command to turn all screens off.";
    };
    screenOnCommand = lib.mkOption {
      type = lib.types.str;
      description = "The compositor's command to turn all screens back on.";
    };

    overrides = lib.mkOption {
      type = lib.types.str;
      default = "${hm.xdg.stateHome}/idle/overrides.conf";
      readOnly = true;
      description = ''
        Runtime overrides of the timings, written by the system overlay's idle settings and sourced after these
        defaults. Deleting the file restores them.
      '';
    };

    settings = lib.mkOption {
      type = lib.types.attrs;
      readOnly = true;
      internal = true;
      description = "The timings in seconds, with the value meaning never, for the overlay's idle settings.";
      default = {
        inherit never;
        inherit (cfg) overrides suspendOnAC;
        dim = seconds cfg.dim;
        lock = seconds cfg.lock;
        screenOff = seconds cfg.screenOff;
        suspend = seconds cfg.suspend;
      };
    };
  };

  config.services.logind.settings.Login.HandleLidSwitch = cfg.sleep;

  # the smallest image the kernel can make, for every hibernation, UPower's critical battery action included: file
  # caches cost more to snapshot and write than to read back afterwards
  config.systemd.tmpfiles.settings.hibernation."/sys/power/image_size".w.argument = "0";

  config.assertions = [
    {
      assertion = cfg.sleep == "suspend" || config.swapDevices != [ ];
      message = "idle.sleep = \"${cfg.sleep}\" writes memory to swap, and no swap device is configured.";
    }
  ];

  config.home-manager.users.${vars.user} = {
    services.hypridle = {
      enable = true;
      # hypridle warns on every start outside Hyprland, about settings this config doesn't use
      package = pkgs.hypridle.overrideAttrs (old: {
        patches = (old.patches or [ ]) ++ [ ./patches/hypridle-no-lock-notify-warning.patch ];
      });
      importantPrefixes = [ "$" "source" ];
      settings = {
        "$idle_dim" = seconds cfg.dim;
        "$idle_lock" = seconds cfg.lock;
        "$idle_screen_off" = seconds cfg.screenOff;
        "$idle_suspend" = seconds cfg.suspend;
        "$idle_suspend_on_ac" = if cfg.suspendOnAC then 1 else 0;
        source = cfg.overrides;

        general = {
          lock_cmd = "${pkgs.procps}/bin/pidof swaylock || ${hm.programs.swaylock.package}/bin/swaylock";
          before_sleep_cmd = "${loginctl} lock-session";
          after_sleep_cmd = cfg.screenOnCommand;
        };

        listener = [
          {
            timeout = "$idle_dim";
            on-timeout = "${brightnessctl} --save set 10%";
            on-resume = "${brightnessctl} --restore";
          }
          {
            timeout = "$idle_lock";
            on-timeout = "${loginctl} lock-session";
          }
          {
            timeout = "$idle_screen_off";
            on-timeout = cfg.screenOffCommand;
            on-resume = cfg.screenOnCommand;
          }
          {
            timeout = "$idle_suspend";
            on-timeout = "${suspend} $idle_suspend_on_ac";
          }
        ];
      };
    };

    # hyprlang rejects a source that doesn't exist
    systemd.user.services.hypridle.Service.ExecStartPre = [
      "${pkgs.coreutils}/bin/mkdir -p ${dirOf cfg.overrides}"
      "${pkgs.coreutils}/bin/touch ${cfg.overrides}"
    ];
  };
}
