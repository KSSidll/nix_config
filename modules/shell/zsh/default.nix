{ pkgs, lib, vars, ... }:
let
  promptSymbol = {
    foreground_templates = [
      "{{if gt .Code 0}}red{{end}}"
      "{{if eq .Code 0}}magenta{{end}}"
    ];
    background = "transparent";
  };
in
{
  programs.zsh = {
    enable = true;
    enableGlobalCompInit = false;
    promptInit = "";
  };

  users.defaultUserShell = pkgs.zsh;

  environment.systemPackages = with pkgs; [
    git # oh-my-posh git segment
  ];

  home-manager.users.${vars.user} = {
    programs.zsh = {
      enable = true;
      enableCompletion = true;
      defaultKeymap = "emacs";

      # sourced in list order after compinit; fzf-tab must load before plugins that wrap widgets,
      # so autosuggestions is a plugin here rather than autosuggestion.enable (which loads earlier)
      plugins = [
        {
          name = "zsh-completions";
          src = "${pkgs.zsh-completions}/share/zsh/site-functions";
        }
        {
          name = "fzf-tab";
          src = "${pkgs.zsh-fzf-tab}/share/fzf-tab";
          file = "fzf-tab.plugin.zsh";
        }
        {
          name = "zsh-autosuggestions";
          src = "${pkgs.zsh-autosuggestions}/share/zsh-autosuggestions";
          file = "zsh-autosuggestions.zsh";
        }
      ];

      syntaxHighlighting.enable = true;

      history = {
        size = 5000;
        save = 5000;
        path = "$HOME/.zsh_history";
        append = true;
        share = true;
        ignoreSpace = true;
        ignoreDups = true;
        ignoreAllDups = true;
        saveNoDups = true;
        findNoDups = true;
      };

      shellAliases = {
        ls = "ls --color";
        ll = "ls -la --color";
        c = "clear";
        enix = "cd ~/.config/nix; $EDITOR .";
        cnix = "cd ~/.config/nix";
        nix-update-flake = "sudo nix flake update --flake ~/.config/nix";
        nix-rebuild-flake-pc = "sudo nixos-rebuild switch --flake ~/.config/nix/.#mainpc --impure";
        nix-rebuild-flake-laptop = "sudo nixos-rebuild switch --flake ~/.config/nix/.#laptop --impure";
        nix-update-os-pc = "nix-update-flake; nix flake archive ~/.config/nix; nix-rebuild-flake-pc";
        nix-update-os-laptop = "nix-update-flake; nix flake archive ~/.config/nix; nix-rebuild-flake-laptop";
      };

      initContent = lib.mkMerge [
        ''
          bindkey '^p' history-search-backward
          bindkey '^n' history-search-forward

          zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
          zstyle ':completion:*' list-colors "''${(s.:.)LS_COLORS}"
          zstyle ':completion:*' menu no
          zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
          zstyle ':fzf-tab:complete:__zoxide_z:*' fzf-preview 'ls --color $realpath'
        ''
        # zoxide's hooks must be installed last; home-manager's integration places it mid-file
        (lib.mkOrder 2000 ''
          eval "$(${lib.getExe pkgs.zoxide} init --cmd cd zsh)"
        '')
      ];
    };

    programs.fzf = {
      enable = true;
      enableZshIntegration = true;
    };

    programs.zoxide = {
      enable = true;
      enableZshIntegration = false;
    };

    programs.oh-my-posh = {
      enable = true;
      enableZshIntegration = true;
      settings = {
        version = 2;
        final_space = true;
        console_title_template = "{{ .Shell }} in {{ .Folder }}";

        blocks = [
          {
            type = "prompt";
            alignment = "left";
            newline = true;
            segments = [
              {
                type = "path";
                style = "plain";
                background = "transparent";
                foreground = "blue";
                template = "{{ .Path }}";
                properties.style = "full";
              }
              {
                type = "git";
                style = "plain";
                foreground = "p:grey";
                background = "transparent";
                template = " {{ .HEAD }}{{ if or (.Working.Changed) (.Staging.Changed) }}*{{ end }} <cyan>{{ if gt .Behind 0 }}⇣{{ end }}{{ if gt .Ahead 0 }}⇡{{ end }}</>";
                properties = {
                  branch_icon = "";
                  commit_icon = "@";
                  fetch_status = true;
                };
              }
            ];
          }
          {
            type = "rprompt";
            overflow = "hidden";
            segments = [
              {
                type = "executiontime";
                style = "plain";
                foreground = "yellow";
                background = "transparent";
                template = "{{ .FormattedMs }}";
                properties.threshold = 5000;
              }
            ];
          }
          {
            type = "prompt";
            alignment = "left";
            newline = true;
            segments = [
              (promptSymbol // {
                type = "text";
                style = "plain";
                template = "❯";
              })
            ];
          }
        ];

        transient_prompt = promptSymbol // { template = "❯ "; };

        secondary_prompt = {
          foreground = "magenta";
          background = "transparent";
          template = "❯❯ ";
        };
      };
    };
  };
}
