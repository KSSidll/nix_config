{ pkgs, vars, ... }:
{
  programs = {
    neovim = {
      enable = true;
      viAlias = true;
      vimAlias = true;
    };
  };

  environment = {
    systemPackages = with pkgs; [
      neovim
      gcc
      clang
      cl
      nodejs
    ];
  };

  environment = {
    variables = {
      EDITOR = "nvim";
    };
  };

  home-manager.users.${vars.user} = {
    home.file = {
      ".config/nvim/init.lua".source = ./nvim/init.lua;
    };
  };
}
