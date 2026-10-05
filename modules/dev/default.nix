{ pkgs, lib, vars, ... }:
{
  home-manager.users.${vars.user}.programs.git.settings.core.editor = "${lib.getExe pkgs.zed-editor} --wait";

  environment = {
    # the nix Python unless a project's requires-python rules it out, then a uv-downloaded build
    variables.UV_PYTHON_PREFERENCE = "system";

    systemPackages = with pkgs; [
      python314
      uv
      zed-editor
      nixd
      lua-language-server
      clang-tools
      rust-analyzer
      pyright
      intelephense
      clang
      nodejs
      package-version-server
      unstable.claude-code
      unstable.herdr
    ];
  };

  # a real dynamic loader for uv's downloaded Pythons
  programs.nix-ld.enable = true;
}
