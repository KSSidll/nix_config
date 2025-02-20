{ pkgs, vars, ... }:
{
  home-manager.users.${vars.user} = {
    home = {
      pointerCursor = {
        gtk.enable = true;
        x11.enable = true;
        package = pkgs.catppuccin-cursors.mochaLavender;
        name = "catppuccin-mocha-lavender-cursors";
        size = 24;
      };
    };

    gtk = {
      enable = true;

      theme = {
        package = pkgs.catppuccin-gtk.override {
          variant = "mocha";
          accents = [ "lavender" ];
        };
        name = "catppuccin-mocha-lavender-standard";
      };

      iconTheme = {
        package = pkgs.catppuccin-papirus-folders.override {
          flavor = "mocha";
          accent = "lavender";
        };
        name = "Papirus-Dark";
      };
    };
  };
}
