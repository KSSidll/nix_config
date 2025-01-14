{ inputs, nixpkgs, home-manager, vars, ... }:
let
  system = "x86_64-linux";

  pkgs = import nixpkgs {
    inherit system;
    config.allowUnfree = true;
  };

  lib = nixpkgs.lib;
in {
  mainpc = lib.nixosSystem {
    inherit system;
    specialArgs = {
      inherit inputs system pkgs vars;
      host = {
        hostName = "mainpc";
      };
    };

    modules = [
      ./mainpc
      ./configuration.nix

      home-manager.nixosModules.home-manager {
        home-manager.useGlobalPkgs = true;
        home-manager.useUserPackages = true;
      }
    ];
  };

  laptop = lib.nixosSystem {
    inherit system;
    specialArgs = {
      inherit inputs system pkgs vars;
      host = {
        hostName = "laptop";
      };
    };

    modules = [
      ./laptop
      ./configuration.nix

      home-manager.nixosModules.home-manager {
        home-manager.useGlobalPkgs = true;
        home-manager.useUserPackages = true;
      }
    ];
  };
}
