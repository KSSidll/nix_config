{ config, lib, pkgs, vars, theme, ... }:
let
  c = theme.colors;
  niri = "${config.programs.niri.package}/bin/niri";

  # a request to the running system overlay over its D-Bus interface; does nothing when the overlay isn't running
  overlay = words: ''spawn "busctl" "--user" "call" "io.Astal.ags" "/io/Astal/Application" "io.Astal.Application" "Request" "as" "${toString (builtins.length words)}" ${lib.concatMapStringsSep " " (w: ''"${w}"'') words};'';

  # pinned popup in the top-right corner, below the bar, like a tray panel
  panelApps = [ "^org\\.pulseaudio\\.pavucontrol$" "^pavucontrol$" "^nm-connection-editor$" ];

  # the bar and the OSD are sized to their content; the panel host and the popup column cover more than they draw,
  # and blur fills a layer's whole surface
  blurred = "^system-overlay(-osd)?$";

  # { "eDP-1".scale = 1.5; } -> output "eDP-1" { scale 1.5; }
  outputs = lib.concatStrings (lib.mapAttrsToList
    (name: settings:
      "output \"${name}\" {${lib.concatStrings (lib.mapAttrsToList (key: value: " ${key} ${builtins.toJSON value};") settings)} }\n")
    config.niri.outputs);

  configKdl = ''
    ${outputs}
    input {
        keyboard {
            xkb {
                layout "pl"
            }
            numlock
        }
        touchpad {
            tap
            natural-scroll
            accel-speed -0.2
            scroll-factor 0.3
        }
        mouse {
            accel-speed -0.65
            scroll-factor 0.75
        }
        mod-key "Alt"
        mod-key-nested "Super"
    }

    layout {
        gaps ${toString theme.geometry.gap}
        // the wallpaper sits in the backdrop, behind every workspace and the overview, so it stays still
        background-color "transparent"
        center-focused-column "never"
        default-column-width { proportion 1.0; }
        preset-column-widths {
            proportion 0.5
            proportion 0.66667
            proportion 1.0
        }
        focus-ring { off; }
        border {
            width ${toString theme.geometry.border}
            active-color "#${c.lavender}aa"
            inactive-color "#${c.lavender}66"
            urgent-color "#${c.red}"
        }
    }

    cursor {
        xcursor-theme "${theme.cursor.name}"
        xcursor-size ${toString theme.cursor.size}
        hide-after-inactive-ms 3000
    }

    hotkey-overlay {
        skip-at-startup
    }

    prefer-no-csd

    switch-events {
        lid-close { spawn "loginctl" "lock-session"; }
    }

    window-rule {
        geometry-corner-radius ${toString theme.geometry.rounding}
        clip-to-geometry true
        opacity 0.9
    }

    window-rule {
        ${lib.concatMapStringsSep "\n        " (id: ''match app-id=r"${id}"'') panelApps}
        open-floating true
        default-floating-position x=${toString theme.geometry.gap} y=${toString theme.geometry.gap} relative-to="top-right"
    }

    layer-rule {
        match namespace="${blurred}"
        background-effect {
            blur true
        }
    }

    layer-rule {
        match namespace="^wallpaper$"
        place-within-backdrop true
    }

    binds {
        Mod+Escape repeat=false { spawn "loginctl" "lock-session"; }

        XF86AudioRaiseVolume allow-when-locked=true { ${overlay [ "volume" "up" ]} }
        XF86AudioLowerVolume allow-when-locked=true { ${overlay [ "volume" "down" ]} }
        XF86AudioMute allow-when-locked=true repeat=false { ${overlay [ "volume" "mute" ]} }
        XF86AudioMicMute allow-when-locked=true repeat=false { ${overlay [ "microphone" "mute" ]} }
        XF86AudioPlay allow-when-locked=true repeat=false { ${overlay [ "media" "play-pause" ]} }
        XF86AudioPause allow-when-locked=true repeat=false { ${overlay [ "media" "play-pause" ]} }
        XF86AudioNext allow-when-locked=true repeat=false { ${overlay [ "media" "next" ]} }
        XF86AudioPrev allow-when-locked=true repeat=false { ${overlay [ "media" "previous" ]} }
        XF86MonBrightnessUp allow-when-locked=true { ${overlay [ "brightness" "up" ]} }
        XF86MonBrightnessDown allow-when-locked=true { ${overlay [ "brightness" "down" ]} }

        // in the screenshot UI, Ctrl+C only copies; Space or Enter also saves the file
        Super+S repeat=false { screenshot; }

        Mod+Return repeat=false { spawn "ghostty" "+new-window"; }
        Mod+D repeat=false { ${overlay [ "launcher" ]} }
        Mod+E repeat=false { spawn "nautilus" "--new-window"; }

        Mod+W repeat=false { close-window; }
        Mod+F repeat=false { toggle-window-floating; }
        Mod+M repeat=false { maximize-column; }
        Mod+Shift+M repeat=false { fullscreen-window; }
        Mod+R repeat=false { switch-preset-column-width; }
        Mod+O repeat=false { toggle-overview; }

        Mod+H { focus-column-left; }
        Mod+L { focus-column-right; }
        Mod+J { focus-window-down; }
        Mod+K { focus-window-up; }

        Mod+Shift+H { move-column-left; }
        Mod+Shift+L { move-column-right; }
        Mod+Shift+J { move-window-down; }
        Mod+Shift+K { move-window-up; }

        Ctrl+Shift+H { set-column-width "-10%"; }
        Ctrl+Shift+L { set-column-width "+10%"; }
        Ctrl+Shift+J { set-window-height "+10%"; }
        Ctrl+Shift+K { set-window-height "-10%"; }

        Mod+Ctrl+J { focus-workspace-down; }
        Mod+Ctrl+K { focus-workspace-up; }
        Mod+Shift+Ctrl+J { move-column-to-workspace-down; }
        Mod+Shift+Ctrl+K { move-column-to-workspace-up; }
        Super+Shift+Ctrl+J { move-column-to-workspace-down focus=false; }
        Super+Shift+Ctrl+K { move-column-to-workspace-up focus=false; }
    }
  '';
in
{
  imports = [
    ../../session
    ../../idle
    ../../night-light
    ../../system-overlay
  ];

  options.niri.outputs = lib.mkOption {
    type = with lib.types; attrsOf (attrsOf (oneOf [ int float ]));
    default = { };
    example = { "eDP-1".scale = 1.5; };
    description = "Per-output niri settings by connector name; outputs not listed use niri's defaults and extend the desktop.";
  };

  config = {
    programs.niri.enable = true;

    services.displayManager.defaultSession = "niri";

    idle = {
      screenOffCommand = "${niri} msg action power-off-monitors";
      screenOnCommand = "${niri} msg action power-on-monitors";
    };

    # niri starts it on demand for X11 apps
    environment.systemPackages = [ pkgs.xwayland-satellite ];

    home-manager.users.${vars.user} = {
      # niri owns org.freedesktop.ScreenSaver and turns its inhibits into idle inhibition, which hypridle already obeys
      services.hypridle.settings.general.ignore_dbus_inhibit = true;

      xdg.configFile."niri/config.kdl".source = pkgs.runCommand "niri-config.kdl"
        {
          nativeBuildInputs = [ config.programs.niri.package ];
          kdl = configKdl;
          passAsFile = [ "kdl" ];
        }
        ''
          niri validate -c "$kdlPath"
          cp "$kdlPath" $out
        '';

      systemd.user.services.swaybg = {
        Unit = {
          Description = "Wallpaper";
          PartOf = [ "graphical-session.target" ];
          After = [ "graphical-session.target" ];
        };
        Service = {
          ExecStart = "${pkgs.swaybg}/bin/swaybg --mode fill --image ${./wallpaper.jpg}";
          Restart = "on-failure";
        };
        Install.WantedBy = [ "graphical-session.target" ];
      };
    };
  };
}
