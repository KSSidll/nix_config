{ lib, pkgs, vars, theme, ... }:
let
  c = theme.colors;
  name = "catppuccin-${theme.flavor}-${theme.accent}";
  systemTheme = { inherit name; icon_theme = theme.icons.name; };
in
{
  systemOverlay.launcher = {
    namespace = "vicinae";
    open = [ "vicinae" "open" ];
    close = [ "vicinae" "close" ];
  };

  home-manager.users.${vars.user} = { config, ... }:
    let
      settings = "${config.xdg.configHome}/vicinae/settings.json";
      home = config.home.homeDirectory;
    in
    {
      programs.vicinae = {
        enable = true;
        systemd.enable = true;

        themes.${name} = {
          meta = {
            version = 1;
            name = "Catppuccin ${lib.toSentenceCase theme.flavor} ${lib.toSentenceCase theme.accent}";
            description = "Catppuccin ${lib.toSentenceCase theme.flavor} with the system's accent";
            variant = "dark";
            inherits = "catppuccin-${theme.flavor}";
          };
          colors.core = {
            accent = "#${c.${theme.accent}}";
            accent_foreground = "#${c.crust}";
          };
        };
      };

      # Vicinae writes changes from its settings window into settings.json and lets that file override the ones it
      # imports, so the Nix defaults are an import; deleting settings.json and restarting the service restores them.
      xdg.configFile."vicinae/nix.json".text = builtins.toJSON {
        theme = { light = systemTheme; dark = systemTheme; };
        font.normal.family = theme.fonts.sans.name;
        launcher_window = {
          rounding = theme.geometry.rounding;
          # above the overlay's dim, which is on the top layer
          layer_shell.layer = "overlay";
        };
        # the helper that pastes into the focused window and expands typed snippets reads and injects input at the
        # kernel level, which needs file capabilities nixpkgs doesn't grant; without it, results are copied instead
        input_server.enabled = false;
        # apps started as vicinae's children would inherit its wrapper's Qt plugin paths and PATH and live in its
        # service's cgroup; niri starts them from the session's environment, each in its own scope
        providers.applications.preferences.launchPrefix = "niri msg action spawn --";
        # folders that churn without holding anything to search for by name; each change there triggers a rescan
        providers.files.preferences.excludedIndexingPaths = map (dir: "${home}/${dir}") [
          ".config/zen"
          ".claude"
          ".local/state"
          "personal/important/.stversions"
          "vaults/passwords/.stversions"
        ];
      };

      systemd.user.services.vicinae.Service = {
        ExecStartPre = "${pkgs.writeShellScript "vicinae-settings" ''
          [ -e "${settings}" ] || echo '{ "imports": ["./nix.json"] }' > "${settings}"
        ''}";
        # the server turns the indexer's debug logging on unless this is set: its check for a debug build is
        # `defined(DEBUG)`, which release builds' DEBUG=0 passes too
        Environment = [ "VICINAE_FILE_INDEXER_LOG=warn" ];
      };
    };
}
