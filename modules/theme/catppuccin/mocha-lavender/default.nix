{ pkgs, lib, vars, inputs, ... }:
let
  flavor = "mocha";
  accent = "lavender";

  # palette name -> hex without '#', e.g. colors.lavender = "b4befe"
  colors = lib.mapAttrs (_: c: lib.removePrefix "#" c.hex)
    (lib.importJSON "${inputs.catppuccin-palette}/palette.json").${flavor}.colors;

  capitalize = s: lib.toUpper (lib.substring 0 1 s) + lib.substring 1 (-1) s;

  icons = {
    # the package builds icon caches that gtk3's setup hook then deletes, and without them every GTK app reads the
    # theme's 340,000 files when it starts
    package = (pkgs.catppuccin-papirus-folders.override { inherit flavor accent; }).overrideAttrs {
      dontDropIconThemeCache = true;
    };
    name = "Papirus-Dark";
  };

  cursor = {
    package = pkgs.catppuccin-cursors."${flavor}${capitalize accent}";
    name = "catppuccin-${flavor}-${accent}-cursors";
    size = 24;
  };

  # the UI's two families; modules name these instead of their own, and fontconfig serves them for sans-serif and monospace
  fonts = {
    sans = { package = pkgs.geist-font; name = "Geist"; };
    mono = { package = pkgs.nerd-fonts.hack; name = "Hack Nerd Font Mono"; };
  };

  # qt5ct and qt6ct both read fonts as Qt 5's ten-field QFont strings, whose weight 50 is regular
  qtct =
    let font = name: ''"${name},11,-1,5,50,0,0,0,0,0"''; in
    {
      Appearance = {
        style = "kvantum";
        icon_theme = icons.name;
        standard_dialogs = "xdgdesktopportal";
        custom_palette = false;
      };
      Fonts = {
        general = font fonts.sans.name;
        fixed = font fonts.mono.name;
      };
    };

  # pixels, shared by the compositor and the system overlay so their edges line up
  geometry = {
    gap = 5;
    rounding = 10;
    border = 2;
  };
in
{
  _module.args.theme = { inherit flavor accent colors cursor icons fonts geometry; };

  fonts = {
    packages = [ fonts.sans.package fonts.mono.package ];
    fontconfig.defaultFonts = {
      sansSerif = [ fonts.sans.name ];
      monospace = [ fonts.mono.name ];
    };
  };

  home-manager.users.${vars.user} = {
    qt = {
      enable = true;
      # qt5ct and qt6ct carry the icons, fonts and file dialogs, which Qt apps otherwise take from nowhere
      platformTheme.name = "qtct";
      style.name = "kvantum";
      qt5ctSettings = qtct;
      qt6ctSettings = qtct;
    };

    # Kvantum finds themes in its config directory, not in the profile's share directory
    xdg.configFile = let kvantum = "catppuccin-${flavor}-${accent}"; in {
      "Kvantum/${kvantum}".source =
        "${pkgs.catppuccin-kvantum.override { variant = flavor; inherit accent; }}/share/Kvantum/${kvantum}";
      "Kvantum/kvantum.kvconfig".text = lib.generators.toINI { } { General.theme = kvantum; };
    };

    programs.delta.options.syntax-theme = "Catppuccin ${capitalize flavor}";

    home.pointerCursor = {
      gtk.enable = true;
      x11.enable = true;
      inherit (cursor) package name size;
    };

    gtk = {
      enable = true;

      gtk4.theme = null;
      theme = {
        package = pkgs.catppuccin-gtk.override {
          variant = flavor;
          accents = [ accent ];
        };
        name = "catppuccin-${flavor}-${accent}-standard";
      };

      iconTheme = icons;
      font.name = fonts.sans.name;
      colorScheme = "dark";
      # GTK 4 reads the scheme from the settings portal, which serves the dconf key colorScheme sets; home-manager's
      # settings.ini entries for it are a number GTK can't parse and a key libadwaita rejects
      gtk4.colorScheme = null;

      # libadwaita ignores GTK themes, so its own color variables carry the palette
      gtk4.extraCss = let c = colors; in ''
        :root {
          --accent-color: #${c.${accent}};
          --accent-bg-color: #${c.${accent}};
          --accent-fg-color: #${c.crust};
          --destructive-color: #${c.red};
          --destructive-bg-color: #${c.red};
          --destructive-fg-color: #${c.crust};
          --success-color: #${c.green};
          --warning-color: #${c.yellow};
          --error-color: #${c.red};
          --window-bg-color: #${c.base};
          --window-fg-color: #${c.text};
          --view-bg-color: #${c.base};
          --view-fg-color: #${c.text};
          --headerbar-bg-color: #${c.mantle};
          --headerbar-fg-color: #${c.text};
          --headerbar-backdrop-color: #${c.base};
          --sidebar-bg-color: #${c.mantle};
          --sidebar-fg-color: #${c.text};
          --sidebar-backdrop-color: #${c.crust};
          --secondary-sidebar-bg-color: #${c.mantle};
          --secondary-sidebar-fg-color: #${c.text};
          --card-bg-color: #${c.surface0};
          --card-fg-color: #${c.text};
          --dialog-bg-color: #${c.mantle};
          --dialog-fg-color: #${c.text};
          --popover-bg-color: #${c.surface0};
          --popover-fg-color: #${c.text};
          --thumbnail-bg-color: #${c.surface0};
          --thumbnail-fg-color: #${c.text};
        }
      '';
    };
  };
}
