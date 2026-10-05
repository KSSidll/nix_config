inputs: final: prev: {
  unstable = import inputs.nixpkgs-unstable {
    inherit (final.stdenv.hostPlatform) system;
    config.allowUnfree = true;
  };
}
