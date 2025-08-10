{
  description = "NixOS system config";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-25.05";

    home-manager = {
      url = "github:nix-community/home-manager/release-25.05";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    ags = {
      url = "github:aylur/ags";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, home-manager, ags, ... }:
  let
    vars = {
      user = "sidll";
    };

    systems = [ "x86_64-linux" ];
    forEachSystem = nixpkgs.lib.genAttrs systems;
  in {
    default = [];

    packages = forEachSystem ( system:
    let
      lib = nixpkgs.lib;
      pkgs = import nixpkgs {
        inherit system;
        config.allowUnfree = true;
      };
    in {
      nixosConfigurations.mainpc = lib.nixosSystem {
        inherit system;
        specialArgs = {
          inherit system pkgs vars ags;
          host = {
            hostName = "mainpc";
          };
        };

        modules = [
          ./configurations/mainpc.nix
          ./configurations/common.nix

          home-manager.nixosModules.home-manager {
            home-manager.useGlobalPkgs = true;
            home-manager.useUserPackages = true;
          }
        ];
      };

      nixosConfigurations.laptop = lib.nixosSystem {
        inherit system;
        specialArgs = {
          inherit system pkgs vars ags;
          host = {
            hostName = "laptop";
          };
        };

        modules = [
          ./configurations/laptop.nix
          ./configurations/common.nix

          home-manager.nixosModules.home-manager {
            home-manager.useGlobalPkgs = true;
            home-manager.useUserPackages = true;
          }
        ];
      };
    });
  };
}
