{ config, lib, pkgs, vars, ... }:
let
  # earlier entries win the types two apps declare (PDF and DjVu go to Papers over OnlyOffice, TIFF to Loupe over Papers)
  handlers = with pkgs; [
    # text/plain covers the code and config types that derive from it, which GLib opens with text/plain's app;
    # OnlyOffice claims Markdown and Zen claims XML, and .ts and .tsx are detected as other formats
    {
      package = config.programs.neovim.finalPackage;
      desktop = "nvim.desktop";
      extraTypes = [
        "text/markdown"
        "application/xml"
        # .ts and .tsx, as shared-mime-info names them
        "text/vnd.trolltech.linguist"
        "application/x-tiled-tsx"
      ];
    }
    { package = loupe; desktop = "org.gnome.Loupe.desktop"; }
    { package = papers; desktop = "org.gnome.Papers.desktop"; }
    # the script makes mpv a player the overlay's media controls see
    { package = mpv.override { scripts = [ mpvScripts.mpris ]; }; desktop = "mpv.desktop"; }
    { package = file-roller; desktop = "org.gnome.FileRoller.desktop"; }
    { package = onlyoffice-desktopeditors; desktop = "onlyoffice-desktopeditors.desktop"; }
  ];

  declaredTypes = { package, desktop, extraTypes ? [ ] }:
    let
      # attribute names can't refer to store paths; the package itself is installed below
      entry = builtins.unsafeDiscardStringContext (builtins.readFile "${package}/share/applications/${desktop}");
      lines = lib.splitString "\n" entry;
      types = lib.removePrefix "MimeType=" (lib.findFirst (lib.hasPrefix "MimeType=") "MimeType=" lines);
    in
    lib.filter (it: it != "") (lib.splitString ";" types) ++ extraTypes;
in
{
  environment.systemPackages = map (it: it.package) handlers ++ [ pkgs.unrar ];

  xdg.mime.defaultApplications = lib.foldr
    (handler: defaults: defaults // lib.genAttrs (declaredTypes handler) (_: handler.desktop))
    { }
    handlers;

  # OnlyOffice lays out Word, Excel and PowerPoint files with the Microsoft fonts they name; substitutes reflow them
  fonts.packages = with pkgs; [ corefonts vista-fonts ];

  home-manager.users.${vars.user}.xdg.configFile."mpv/mpv.conf".text = ''
    hwdec=auto-safe
  '';
}
