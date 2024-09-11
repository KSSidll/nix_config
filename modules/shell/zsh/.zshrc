ZINIT_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}/zinit/zinit.git"

if [ ! -d "$ZINIT_HOME" ]; then
    mkdir -p "$(dirname $ZINIT_HOME)"
    git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
fi

source "${ZINIT_HOME}/zinit.zsh"

zinit light zsh-users/zsh-syntax-highlighting
zinit light zsh-users/zsh-completions
zinit light zsh-users/zsh-autosuggestions
zinit light Aloxaf/fzf-tab

autoload -U compinit && compinit

zinit cdreplay -q

eval "$(oh-my-posh init zsh --config $HOME/.config/oh-my-posh/zen.toml)"

# TODO change to vim mode??
bindkey -e

bindkey '^p' history-search-backward
bindkey '^n' history-search-forward

HISTSIZE=5000
HISTFILE=~/.zsh_history
SAVEHIST=$HISTSIZE
HISTDUP=erase

setopt appendhistory
setopt sharehistory
setopt hist_ignore_space
setopt hist_ignore_all_dups
setopt hist_save_no_dups
setopt hist_ignore_dups
setopt hist_find_no_dups

zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*' menu no
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
zstyle ':fzf-tab:complete:__zoxide_z:*' fzf-preview 'ls --color $realpath'

alias ls='ls --color'
alias ll='ls -la --color'
alias c='clear'
alias enix='cd ~/.config/nix; $EDITOR .'
alias nix-update-flake='sudo nix flake update ~/.config/nix'
alias nix-rebuild-flake-pc='sudo nixos-rebuild switch --flake ~/.config/nix/.#mainpc --impure'
alias nix-rebuild-flake-laptop='sudo nixos-rebuild switch --flake ~/.config/nix/.#laptop --impure'
alias nix-update-os-pc='nix-update-flake; nix-rebuild-flake-pc'
alias nix-update-os-laptop='nix-update-flake; nix-rebuild-flake-laptop'

eval "$(fzf --zsh)"
eval "$(zoxide init --cmd cd zsh)"
