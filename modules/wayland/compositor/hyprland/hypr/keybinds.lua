---------------------
---- MY PROGRAMS ----
---------------------
local lockScreen = "swaylock --config ~/.config/swaylock/config"
local term = "alacritty"
local files = "nautilus"

local mainMod = "ALT"
local windowChangeWorkspaceSilentMod = "SUPER"
local windowResizeMod = "CTRL + SHIFT"
local screenLockKeys = "SUPER + L"

--------------------
---- SCREEN LOCK ----
--------------------
hl.bind(screenLockKeys, hl.dsp.exec_cmd(lockScreen))
hl.bind("switch: Lid Switch", hl.dsp.exec_cmd(lockScreen), { locked = true })

-------------
---- MOUSE ----
-------------
hl.bind(mainMod .. " + mouse:272", hl.dsp.window.drag(), { mouse = true })

-------------------
---- SCREENSHOT ----
-------------------
hl.bind("SUPER + SHIFT + S", hl.dsp.exec_cmd("hyprshot -m region --clipboard-only"))
hl.bind("SUPER + SHIFT + CTRL + S", hl.dsp.exec_cmd("hyprshot -m region"))

------------
---- MISC ----
------------
hl.bind(mainMod .. " + Return", hl.dsp.exec_cmd(term))
hl.bind(mainMod .. " + E", hl.dsp.exec_cmd(files))
hl.bind(mainMod .. " + D", hl.dsp.exec_cmd("killall rofi || rofi -show drun"))
hl.bind(mainMod .. " + B", hl.dsp.exec_cmd("killall -SIGUSR1 .waybar-wrapped"))
hl.bind(mainMod .. " + SHIFT + B", hl.dsp.exec_cmd("killall -SIGUSR2 .waybar-wrapped"))

-----------------------------
---- WINDOW MANAGEMENT ----
-----------------------------
hl.bind(mainMod .. " + W", hl.dsp.window.close())
hl.bind(mainMod .. " + F", hl.dsp.window.float({ action = "toggle" }))
hl.bind(mainMod .. " + P", hl.dsp.window.pseudo())

-------------------------------
---- WINDOW CHANGE FOCUS ----
-------------------------------
hl.bind(mainMod .. " + H", hl.dsp.focus({ direction = "left" }))
hl.bind(mainMod .. " + J", hl.dsp.focus({ direction = "down" }))
hl.bind(mainMod .. " + K", hl.dsp.focus({ direction = "up" }))
hl.bind(mainMod .. " + L", hl.dsp.focus({ direction = "right" }))

------------------------
---- WINDOW MOVE ----
------------------------
hl.bind(mainMod .. " + SHIFT + H", hl.dsp.window.swap({ direction = "left" }))
hl.bind(mainMod .. " + SHIFT + J", hl.dsp.window.swap({ direction = "down" }))
hl.bind(mainMod .. " + SHIFT + K", hl.dsp.window.swap({ direction = "up" }))
hl.bind(mainMod .. " + SHIFT + L", hl.dsp.window.swap({ direction = "right" }))

--------------------------
---- WINDOW RESIZE ----
--------------------------
hl.bind(windowResizeMod .. " + H", hl.dsp.window.resize({ x = -60, y = 0, relative = true }))
hl.bind(windowResizeMod .. " + J", hl.dsp.window.resize({ x = 0, y = 60, relative = true }))
hl.bind(windowResizeMod .. " + K", hl.dsp.window.resize({ x = 0, y = -60, relative = true }))
hl.bind(windowResizeMod .. " + L", hl.dsp.window.resize({ x = 60, y = 0, relative = true }))

--------------------------------------
---- WINDOW CHANGE WORKSPACE ----
--------------------------------------
-- follow = true switches the active workspace along with the window (movetoworkspace)
hl.bind(mainMod .. " + SHIFT + CTRL + H", hl.dsp.window.move({ workspace = "r-1", follow = true }))
hl.bind(mainMod .. " + SHIFT + CTRL + L", hl.dsp.window.move({ workspace = "r+1", follow = true }))

---------------------------------------------
---- WINDOW CHANGE WORKSPACE SILENT ----
---------------------------------------------
-- follow omitted (false) keeps the active workspace put (movetoworkspacesilent)
hl.bind(windowChangeWorkspaceSilentMod .. " + SHIFT + CTRL + H", hl.dsp.window.move({ workspace = "r-1" }))
hl.bind(windowChangeWorkspaceSilentMod .. " + SHIFT + CTRL + L", hl.dsp.window.move({ workspace = "r+1" }))

------------------------------
---- WORKSPACE SWITCH ----
------------------------------
hl.bind(mainMod .. " + CTRL + H", hl.dsp.focus({ workspace = "r-1" }))
hl.bind(mainMod .. " + CTRL + L", hl.dsp.focus({ workspace = "r+1" }))
