{
  description = "NixOS system config";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-26.05";
    nixpkgs-unstable.url = "github:nixos/nixpkgs/nixos-unstable";

    home-manager = {
      url = "github:nix-community/home-manager/release-26.05";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    astal = {
      url = "github:aylur/astal";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    ags = {
      url = "github:aylur/ags";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.astal.follows = "astal";
    };

    zen-browser = {
      url = "github:youwen5/zen-browser-flake";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    arkenfox = {
      url = "github:arkenfox/user.js/144.0";
      flake = false;
    };

    catppuccin-palette = {
      url = "github:catppuccin/palette";
      flake = false;
    };

    yazi-flavors = {
      url = "github:yazi-rs/flavors";
      flake = false;
    };
  };

  outputs = inputs@{ nixpkgs, ... }:
  let
    vars = {
      user = "sidll";
    };

    mkHost = hostName: nixpkgs.lib.nixosSystem {
      specialArgs = { inherit inputs vars; };

      modules = [
        ./modules/core
        ./hosts/${hostName}
        { networking.hostName = hostName; }
      ];
    };
  in {
    nixosConfigurations = nixpkgs.lib.genAttrs [ "laptop" "mainpc" ] mkHost;

    devShells.x86_64-linux.ags =
      let
        pkgs = nixpkgs.legacyPackages.x86_64-linux;
        agsPkgs = inputs.ags.packages.x86_64-linux;
      in
      pkgs.mkShell {
        packages = [
          (import ./modules/wayland/system-overlay/astal.nix { inherit pkgs agsPkgs; }).ags
          pkgs.watchexec
          pkgs.typescript
        ];
      };
  };
}
