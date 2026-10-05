{ config, ... }:
{
  services.udev.extraRules = ''
    # the Wi-Fi card drives a traffic LED the laptop doesn't have, and each blink is a register write that wakes it
    ACTION=="add", SUBSYSTEM=="leds", KERNEL=="rtw88-*", ATTR{trigger}="none"
    ACTION=="add", SUBSYSTEM=="pci", ATTR{power/control}="auto"
  '';

  boot.kernel.sysctl."kernel.nmi_watchdog" = 0;

  # on battery the GPU dims the backlight with the picture's content and raises contrast to compensate; the daemon ships
  # the action off, and powerprofilesctl can turn it off again until the next start
  systemd.services.power-profiles-daemon.serviceConfig.ExecStartPost =
    "${config.services.power-profiles-daemon.package}/bin/powerprofilesctl configure-action amdgpu_panel_power --enable";
}
