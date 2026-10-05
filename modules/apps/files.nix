{ pkgs, vars, inputs, theme, ... }:
let
  flavor = "catppuccin-${theme.flavor}";
in
{
  # niri's module already registers Nautilus on the session bus for the portal's file dialogs; this makes it an app
  environment.systemPackages = [ pkgs.nautilus ];

  services.gvfs.enable = true;

  # system-wide defaults, which ~/.config/mimeapps.list overrides where apps or the user set their own
  xdg.mime.defaultApplications."inode/directory" = "org.gnome.Nautilus.desktop";

  home-manager.users.${vars.user}.programs.yazi = {
    enable = true;
    enableZshIntegration = true;
    shellWrapperName = "y";
    flavors.${flavor} = "${inputs.yazi-flavors}/${flavor}.yazi";
    theme.flavor = {
      dark = flavor;
      light = flavor;
    };
  };
}
