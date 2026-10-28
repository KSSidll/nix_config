{ lib, pkgs, vars, ... }:
let
  # KeePassXC's settings by its own key names; plain values only, since Qt writes some others back in another form,
  # which would read as a change made in KeePassXC's settings window
  settings.FdoSecrets = {
    Enabled = true;
    # KeePassXC can't refuse deletions outright; each one an app asks for waits for confirmation, and a confirmed one
    # goes to the recycle bin
    ConfirmDeleteItem = true;
  };

  # loads the keys entries carry into the session's agent, gcr's, at SSH_AUTH_SOCK
  settings.SSHAgent.Enabled = true;

  settings.Browser.Enabled = true;

  settings.GUI = {
    # the classic theme draws with the Qt style, Kvantum's Catppuccin; KeePassXC's own themes bring their own colors
    ApplicationTheme = "classic";
    TrayIconAppearance = "monochrome-light";
    # it runs for the whole session, waiting in the tray for the integrations' requests
    ShowTrayIcon = true;
    MinimizeToTray = true;
    MinimizeOnStartup = true;
    MinimizeOnClose = true;
  };

  defaults = (pkgs.formats.ini { }).generate "keepassxc-defaults.ini" settings;
  mergeSettings = pkgs.writers.writePython3 "keepassxc-merge-settings" { } (builtins.readFile ./merge-settings.py);
in
{
  environment.systemPackages = [ pkgs.keepassxc ];

  # KeePassXC is the Secret Service, which gnome-keyring would claim first; niri's module turns it on for its portal,
  # which only Flatpak apps use and KeePassXC doesn't implement
  services.gnome.gnome-keyring.enable = false;
  xdg.portal.config.niri."org.freedesktop.impl.portal.Secret" = lib.mkForce "none";
  # the session's SSH agent, which otherwise follows gnome-keyring's setting
  services.gnome.gcr-ssh-agent.enable = true;

  home-manager.users.${vars.user} = { config, ... }: {
    # keepassxc-browser's host, where Zen looks for it like Firefox does; KeePassXC rewrites this file, and reports a
    # failure, unless it already says what KeePassXC would write, so the path is its own proxy
    home.file.".mozilla/native-messaging-hosts/org.keepassxc.keepassxc_browser.json".text = builtins.toJSON {
      name = "org.keepassxc.keepassxc_browser";
      description = "KeePassXC integration with native messaging support";
      path = "${pkgs.keepassxc}/bin/keepassxc-proxy";
      type = "stdio";
      allowed_extensions = [ "keepassxc-browser@keepassxc.org" ];
    };

    systemd.user.services.keepassxc = {
      Unit = {
        Description = "KeePassXC";
        PartOf = [ "graphical-session.target" ];
        # its tray icon needs the overlay's tray host to exist when it starts
        After = [ "graphical-session.target" "system-overlay.service" ];
      };
      Service = {
        ExecStartPre = "${mergeSettings} ${defaults} ${config.xdg.configHome}/keepassxc/keepassxc.ini ${config.xdg.stateHome}/keepassxc";
        ExecStart = "${pkgs.keepassxc}/bin/keepassxc ${config.home.homeDirectory}/vaults/passwords/passwd.kdbx";
        Restart = "on-failure";
        # Qt's GTK theme draws GTK's file dialog in-process: through qt5ct's portal dialog, the portal can't identify
        # KeePassXC, which hides its /proc entries by making itself non-dumpable, and refuses the request
        Environment = [ "QT_QPA_PLATFORMTHEME=gtk3" ];
      };
      Install.WantedBy = [ "graphical-session.target" ];
    };
  };
}
