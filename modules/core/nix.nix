{ inputs, ... }:
{
  nixpkgs = {
    config.allowUnfree = true;
    overlays = [ (import ../../overlays inputs) ];
  };

  nix = {
    channel.enable = false;

    settings = {
      experimental-features = [ "nix-command" "flakes" ];
      auto-optimise-store = true;
    };

    gc = {
      automatic = true;
      dates = "weekly";
      options = "--delete-older-than 14d";
    };
  };
}
