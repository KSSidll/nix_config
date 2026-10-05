{ config, lib, vars, ... }:
let
  cfg = config.nightLight;
in
{
  options.nightLight = {
    enable = lib.mkEnableOption "warmer screen colours between sunset and sunrise";

    latitude = lib.mkOption {
      type = lib.types.float;
      description = "Latitude that sunset and sunrise are computed for.";
    };

    longitude = lib.mkOption {
      type = lib.types.float;
      description = "Longitude that sunset and sunrise are computed for.";
    };

    temperature = lib.mkOption {
      type = lib.types.ints.between 1000 6499;
      default = 4000;
      description = "Colour temperature at night, in kelvin; daytime stays at a neutral 6500 K.";
    };
  };

  config = lib.mkIf cfg.enable {
    home-manager.users.${vars.user}.services.wlsunset = {
      enable = true;
      inherit (cfg) latitude longitude;
      temperature.night = cfg.temperature;
    };
  };
}
