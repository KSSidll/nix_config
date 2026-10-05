{ vars, ... }:
{
  services.syncthing = {
    enable = true;

    user = vars.user;
    dataDir = "/home/${vars.user}";
    openDefaultPorts = true;
  };
}
