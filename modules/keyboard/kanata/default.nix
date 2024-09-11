{ vars, ... }:
{
  services.kanata = {
    enable = true;

    keyboards = {
      laptop = {
        devices = [
          "/dev/input/by-path/platform-i8042-serio-0-event-kbd"
        ];

        config = ''
          (defsrc
            grv  1    2    3    4    5    6    7    8    9    0    -    =    bspc
            tab  q    w    e    r    t    y    u    i    o    p    [    ]    \
            caps a    s    d    f    g    h    j    k    l    ;    '    ret
            lsft z    x    c    v    b    n    m    ,    .    /    rsft
            lctl lmet lalt           spc            ralt rctl)

          (defalias
            l1 (layer-while-held letters-1)
            mv (layer-while-held movement)
            sb (layer-while-held symbols))

          (deflayer letters-0
            _    _    _    _    _    _    _    _    _    _    _    _    _    _
            _    ;    d    r    c    XX   '    l    u    p    /    \    XX   XX
            lalt a    s    h    t    ,    tab  n    e    o    i    -    _
            rctl M-s  XX   @mv  .    XX   @sb  x    c    v    z    S-2
            lctl lsft spc            @l1            rctl ralt)

          (deflayer letters-1
            _    _    _    _    _    _    _    _    _    _    _    _    _    _
            _    _    _    q    b    _    _    y    g    _    _    _    _    _
            _    z    x    m    w    _    _    f    j    k    v    _    _
            _    RA-z RA-x _    _    _    _    _    _    _    _    _
            _    _    _              _              _    _)

          (deflayer movement
            _    _    _    _    _    _    _    _    _    _    _    _    _    _
            _    _    _    _    _    _    _    _    up   _    _    _    _    _
            _    _    _    _    _    _    _    left down rght _    _    _
            _    _    _    _    _    _    _    _    _    _    _    _
            _    _    _              _              _    _)

          (deflayer symbols
            _    _    _    _    _    _    _    _    _    _     _    _    _    _
            _    _    _    S-4  S-5  _    _    =    S-8  S-=   S-6  _    _    _
            _    _    S-[  [    S-9  _    _    S-0  ]    S-]   S-1  _    _
            _    _    _    _    _    _    _    S-7  grv  S-grv S-3  _
            _    _    _              _              _    _)
        '';
      };
    };
  };
}
