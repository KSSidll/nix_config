{ ... }:
{
  time.timeZone = "Europe/Warsaw";

  i18n = {
    defaultLocale = "en_US.UTF-8";
    # Monday-first weeks and day-month dates
    extraLocaleSettings.LC_TIME = "en_GB.UTF-8";
  };

  console = {
    font = "Lat2-Terminus16";
    keyMap = "us";
  };
}
