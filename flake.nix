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
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, home-manager, ... }:
  let
    inputs = self.inputs;

    vars = {
      user = "sidll";
    };

    systems = [ "x86_64-linux" ];
    forEachSystem = nixpkgs.lib.genAttrs systems;
  in {
    packages = forEachSystem ( system:
    let
      lib = nixpkgs.lib;

      commonModules = [
        {
          nixpkgs.config.allowUnfree = true;
        }

        ./configurations/common.nix

        home-manager.nixosModules.home-manager {
          home-manager.useGlobalPkgs = true;
          home-manager.useUserPackages = true;
        }
      ];
    in {

      nixosConfigurations.mainpc = lib.nixosSystem {
        inherit system;
        specialArgs = {
          inherit system vars inputs;
          host.hostName = "mainpc";
        };

        modules = commonModules ++ [
          ./configurations/mainpc.nix
        ];
      };

      nixosConfigurations.laptop = lib.nixosSystem {
        inherit system;
        specialArgs = {
          inherit system vars inputs;
          host.hostName = "laptop";
        };

        modules = commonModules ++ [
          ./configurations/laptop.nix
        ];
      };
    });
  };
}
