-------------------------------------------------
---- SOURCED FILES
-------------------------------------------------
require("keybinds")
require("windowrules")

-------------------
---- AUTOSTART ----
-------------------
hl.on("hyprland.start", function()
    hl.exec_cmd("dunst")
    hl.exec_cmd("hyprpaper")
    hl.exec_cmd("system-overlay")
end)

------------------
---- MONITORS ----
------------------
hl.monitor({
    output = "eDP-1",
    mode = "preferred",
    position = "auto",
    scale = "auto",
})

hl.monitor({
    output = "",
    mode = "preferred",
    position = "auto",
    scale = "auto",
    mirror = "eDP-1",
})

------------------
---- GESTURES ----
------------------
hl.gesture({
    fingers = 3,
    direction = "horizontal",
    action = "workspace",
})

-----------------------
---- LOOK AND FEEL ----
-----------------------
hl.config({
    general = {
        border_size = 2,
        gaps_in = 4,
        gaps_out = 5,
        col = {
            inactive_border = "0x66b4befe",
            active_border = "0xaab4befe",
        },
        layout = "dwindle",
    },

    decoration = {
        rounding = 10,
        blur = {
            enabled = true,
            size = 4,
            passes = 1,
        },
    },

    animations = {
        enabled = true,
    },
})

-- Bezier curves
hl.curve("win", { type = "bezier", points = { {0.05, 0.9}, {0.1, 1.05} } })
hl.curve("winIn", { type = "bezier", points = { {0.1, 1.1}, {0.1, 1.1} } })
hl.curve("winOut", { type = "bezier", points = { {0.3, -0.3}, {0, 1} } })
hl.curve("linear", { type = "bezier", points = { {1, 1}, {1, 1} } })

-- Animations
hl.animation({ leaf = "windows", enabled = true, speed = 6, bezier = "win", style = "slide" })
hl.animation({ leaf = "windowsIn", enabled = true, speed = 6, bezier = "winIn", style = "slide" })
hl.animation({ leaf = "windowsOut", enabled = true, speed = 5, bezier = "winOut", style = "slide" })
hl.animation({ leaf = "windowsMove", enabled = true, speed = 5, bezier = "win", style = "slide" })
hl.animation({ leaf = "border", enabled = true, speed = 1, bezier = "linear" })
hl.animation({ leaf = "borderangle", enabled = true, speed = 30, bezier = "linear", style = "loop" })
hl.animation({ leaf = "fade", enabled = true, speed = 10, bezier = "winOut" })
hl.animation({ leaf = "workspaces", enabled = true, speed = 5, bezier = "win" })

---------------
---- INPUT ----
---------------
hl.config({
    input = {
        kb_layout = "pl",
        follow_mouse = 2,
        numlock_by_default = true,
        sensitivity = -0.65,
        scroll_factor = 0.75,
        touchpad = {
            natural_scroll = true,
            scroll_factor = 0.3,
        },
    },
})

hl.device({
    name = "elan071a:00-04f3:30fd-touchpad",
    sensitivity = -0.2,
})

----------------
---- MISC ----
----------------
hl.config({
    misc = {
        disable_hyprland_logo = true,
        disable_splash_rendering = true,
        mouse_move_enables_dpms = true,
        key_press_enables_dpms = true,
        animate_manual_resizes = true,
        disable_autoreload = true, -- linked directly, so no need to watch for changes
        focus_on_activate = true,
        mouse_move_focuses_monitor = false,
        initial_workspace_tracking = 2,
    },
})

------------------
---- XWAYLAND ----
------------------
hl.config({
    xwayland = {
        use_nearest_neighbor = false,
        force_zero_scaling = true,
    },
})

-----------------
---- CURSOR -----
-----------------
hl.config({
    cursor = {
        inactive_timeout = 3,
    },
})

-----------------
---- DWINDLE ----
-----------------
hl.config({
    dwindle = {
        preserve_split = true,
    },
})
