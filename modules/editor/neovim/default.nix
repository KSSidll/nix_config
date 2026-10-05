{ lib, pkgs, theme, ... }:
{
  programs.neovim = {
    enable = true;
    defaultEditor = true;
    viAlias = true;
    vimAlias = true;

    configure = {
      customLuaRC = "vim.g.nix = ${lib.generators.toLua { } { inherit (theme) flavor; }}\n" + builtins.readFile ./nvim/init.lua;

      packages.main.start = with pkgs.vimPlugins; [
        vim-fugitive
        vim-rhubarb
        vim-sleuth
        vim-surround
        comment-nvim
        nvim-autopairs
        quick-scope
        undotree
        vista-vim

        catppuccin-nvim
        lualine-nvim
        nvim-web-devicons
        fidget-nvim
        trouble-nvim

        plenary-nvim
        telescope-nvim
        telescope-fzf-native-nvim

        nvim-treesitter.withAllGrammars
        nvim-treesitter-textobjects
        nvim-treesitter-context

        nvim-lspconfig
        lazydev-nvim

        nvim-cmp
        cmp-nvim-lsp
        cmp-buffer
        luasnip
        cmp_luasnip
        friendly-snippets
      ];
    };
  };

  environment.systemPackages = with pkgs; [
    ripgrep
    fd
  ];
}
