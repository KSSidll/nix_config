{ pkgs, ... }:
{
  services.printing = {
    enable = true;
    drivers = with pkgs; [ gutenprint brlaser ];
    # CUPS lists printers that need no driver by itself; cups-browsed only adds queues for printers shared the legacy
    # CUPS way, and listens on the network for them
    browsed.enable = false;
  };

  services.avahi = {
    enable = true;
    nssmdns4 = true;
  };

  services.ipp-usb.enable = true;

  programs.system-config-printer.enable = true;
}
