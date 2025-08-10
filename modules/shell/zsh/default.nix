{ pkgs, vars, ... }:
{
  programs.zsh = {
    enable = true;
    enableGlobalCompInit = false;
    promptInit = "";
  };



  environment = {
    variables = {
      SHELL = "zsh";
    };

    systemPackages = with pkgs; [
      git
      fzf
      zoxide
      zsh
      oh-my-posh
    ];

    shells = with pkgs; [
      zsh
    ];
  };

  fonts.packages = with pkgs; [
      nerd-fonts.hack
  ];

  users.defaultUserShell = pkgs.zsh;

  home-manager.users.${vars.user} = {
    home.file = {
      ".zshrc".source = ./.zshrc;
      ".config/oh-my-posh".source = ./oh-my-posh;
    };
  };
}
