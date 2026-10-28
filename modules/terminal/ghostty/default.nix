{ config, lib, pkgs, vars, theme, ... }:
let
  ghostty = config.home-manager.users.${vars.user}.programs.ghostty.package;

  # the terminal for desktop entries that ask for one; Ghostty's own entry starts a separate instance for a command,
  # with the whole startup that costs, while this opens a window of the running one
  window = pkgs.makeDesktopItem {
    name = "ghostty-window";
    desktopName = "Ghostty window";
    exec = "${lib.getExe ghostty} +new-window";
    noDisplay = true;
    categories = [ "System" "TerminalEmulator" ];
    extraConfig = {
      X-TerminalArgExec = "-e";
      X-TerminalArgDir = "--working-directory=";
      X-TerminalArgTitle = "--title=";
    };
  };
in
{
  environment.variables.TERMINAL = "ghostty";

  environment.systemPackages = [ window ];
  # GLib starts terminal apps through xdg-terminal-exec, and its own fallback list doesn't include Ghostty
  xdg.terminal-exec = {
    enable = true;
    settings.default = [ "ghostty-window.desktop" ];
  };

  home-manager.users.${vars.user} = { config, ... }: {
    # the service's unit wants graphical-session.target but home-manager only links it, so nothing would start it
    # before the first window, which then pays for Ghostty's whole startup
    xdg.configFile."systemd/user/graphical-session.target.wants/app-com.mitchellh.ghostty.service".source =
      "${config.programs.ghostty.package}/share/systemd/user/app-com.mitchellh.ghostty.service";

    programs.ghostty = {
      enable = true;
      enableZshIntegration = true;
      settings = {
        theme = "Catppuccin ${lib.toSentenceCase theme.flavor}";
        font-family = theme.fonts.mono.name;

        cursor-style = "bar";
        cursor-style-blink = false;

        window-padding-x = 15;
        window-padding-y = 10;

        mouse-scroll-multiplier = "precision:0.75,discrete:2.25";

        # the kernel counts an idle io_uring wait as I/O wait, so the default backend pins I/O pressure near 100% and
        # adds 1 to the load average while nothing touches the disk
        async-backend = "epoll";
      };
    };
  };
}
