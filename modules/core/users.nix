{ vars, ... }:
{
  users.users.${vars.user} = {
    isNormalUser = true;
    extraGroups = [ "wheel" ];
  };
}
