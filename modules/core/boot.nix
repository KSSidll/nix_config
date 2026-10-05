{ ... }:
{
  boot = {
    loader = {
      systemd-boot = {
        enable = true;
        configurationLimit = 5;
        # editing the kernel command line at the menu gives a root shell to anyone at the keyboard
        editor = false;
      };

      efi.canTouchEfiVariables = true;

      timeout = 0; # hold Space during boot to show the menu
    };

    tmp = {
      useTmpfs = true;
      tmpfsSize = "5G";
    };
  };
}
