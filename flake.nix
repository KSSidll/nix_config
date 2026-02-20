{
  description = "NixOS system config";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-25.11";

    home-manager = {
      url = "github:nix-community/home-manager/release-25.11";
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
      inputs.nixpkgx.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, home-manager, ags, astal, zen-browser, ... }:
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
          inherit system pkgs vars ags astal zen-browser;
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
          inherit system pkgs vars ags astal zen-browser;
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
