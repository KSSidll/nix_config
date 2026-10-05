{ config, pkgs, lib, vars, inputs, ... }:
let
  cfg = config.zenBrowser;
  profile = "j9kexz06.arken";

  # appended after arkenfox, so these win
  overrides =
    # relaxed arkenfox defaults
    {
      "browser.startup.page" = 3; # restore previous session
      "browser.cache.disk.enable" = true;
      "privacy.sanitize.sanitizeOnShutdown" = false;
      "browser.search.suggest.enabled" = true;
      "browser.urlbar.suggest.searches" = true;
      "browser.search.separatePrivateDefault" = false;
      "browser.search.separatePrivateDefault.ui.enabled" = false;
    }
    # custom
    // {
      "browser.toolbars.bookmarks.visibility" = "always";
    }
    # urlbar
    // {
      "browser.urlbar.suggest.calculator" = true;
      "browser.urlbar.unitConversion.enabled" = true;
      # untrimmed URLs look worse, but the full scheme and path matter when reading a URL
      "browser.urlbar.trimHttps" = false;
      "browser.urlbar.trimURLs" = false;
    }
    # theming
    // {
      "widget.non-native-theme.scrollbar.style" = 2; # normal scrollbar
      "widget.gtk.rounded-bottom-corners.enabled" = true;
    }
    # media: sites like YouTube prefer AV1 whenever the browser offers it; offering only codecs the GPU decodes keeps
    # video off the CPU
    // lib.optionalAttrs (!cfg.hardwareAv1) {
      "media.av1.enabled" = false;
    };

  # JSON literals (strings, bools, numbers) are valid JS, so toJSON quotes values correctly
  overridesJs = pkgs.writeText "user-overrides.js" (
    "\n/*** USER OVERRIDES ***/\n"
    + lib.concatStrings (lib.mapAttrsToList (name: value: "user_pref(${builtins.toJSON name}, ${builtins.toJSON value});\n") overrides)
  );
in {
  options.zenBrowser.hardwareAv1 = lib.mkOption {
    type = lib.types.bool;
    default = true;
    description = "Whether the GPU decodes AV1 video; without it, Zen doesn't offer AV1 to sites.";
  };

  config.environment.systemPackages = [
    inputs.zen-browser.packages.${pkgs.stdenv.hostPlatform.system}.default
  ];

  config.home-manager.users.${vars.user}.home.file = {
    ".config/zen/profiles.ini".text = lib.generators.toINI { } {
      General = {
        StartWithLastProfile = 1;
        Version = 2;
      };

      Profile0 = {
        Name = "arken";
        IsRelative = 1;
        Path = profile;
        Default = 1;
      };
    };

    ".config/zen/${profile}/user.js".source = pkgs.concatText "user.js" [
      "${inputs.arkenfox}/user.js"
      overridesJs
    ];
  };
}
