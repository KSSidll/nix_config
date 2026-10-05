{ lib, vars, ... }:
let
  # the identity commits get by where the repository lives; the global one covers everything else
  identities = {
    "~/dev/personal/" = { name = "Szymon Kolasa"; email = "kolasasidll@gmail.com"; };
    "~/dev/work/dice-software/" = { name = "Szymon Kolasa"; email = "szymon.kolasa@dice-software.com"; };
    "~/dev/work/oizo-world/" = { name = "Szymon Kolasa"; email = "szymon@oizo.world"; };
    "~/dev/work/reds/" = { name = "Szymon Kolasa"; email = "szymon.kolasa@reds.com.pl"; };
  };
in
{
  home-manager.users.${vars.user} = { config, ... }: {
    programs.git = {
      enable = true;
      lfs.enable = true;

      settings = {
        user = {
          name = "KSSidll";
          email = "kolasasidll@gmail.com";
        };
        init.defaultBranch = "stable";
        # delta's integration covers diff, log, show and blame; this covers the rest, like stash show -p
        core.pager = lib.getExe config.programs.delta.package;
        commit.verbose = true;
        pull.rebase = true;
        push.autoSetupRemote = true;
        fetch.prune = true;
        transfer.fsckObjects = true;
        rebase = {
          autoStash = true;
          autoSquash = true;
        };
        rerere.enabled = true;
        merge.conflictStyle = "zdiff3";
        diff = {
          algorithm = "histogram";
          colorMoved = "default";
          colorMovedWS = "allow-indentation-change";
          context = 10;
          submodule = "log";
          tool = "difftastic";
        };
        difftool = {
          prompt = false;
          # git's external-diff argument list, so difft names the file by its path, not by git's temporary copy;
          # the hashes and modes are placeholders
          difftastic.cmd = ''${lib.getExe config.programs.difftastic.package} "$MERGED" "$LOCAL" abcdef1 100644 "$REMOTE" abcdef2 100644'';
        };
        pager.difftool = true;
        # a new branch tracks nothing until its first push, so autoSetupRemote gives it its own remote branch
        branch = {
          sort = "-committerdate";
          autoSetupMerge = false;
        };
        log.date = "iso";
        status.submoduleSummary = true;
        submodule.recurse = true;
        help.autocorrect = "prompt";
      };

      includes = lib.mapAttrsToList (dir: user: { condition = "gitdir:${dir}"; contents.user = user; }) identities;

      ignores = [ "**/.claude/settings.local.json" ];
    };

    programs.delta = {
      enable = true;
      enableGitIntegration = true;
      options = {
        navigate = true;
        line-numbers = true;
      };
    };

    # only as the difftool; its git integration would make it the engine behind git diff, displacing delta
    programs.difftastic.enable = true;
  };
}
