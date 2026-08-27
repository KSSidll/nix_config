--------------
---- DEFAULTS ----
--------------
hl.window_rule({
    name = "default-opacity",
    match = { class = "^(.*)$" },
    opacity = "0.90 0.90",
})

------------
---- ROFI ----
------------
hl.layer_rule({
    name = "rofi-dim-around",
    match = { namespace = "(rofi)" },
    dim_around = true,
})

--------------------
---- WEB BROWSERS ----
--------------------
hl.window_rule({
    name = "floorp-opacity",
    match = { class = "^(floorp)$" },
    opacity = "0.95 0.95",
})

hl.window_rule({
    name = "floorp-youtube-opacity",
    match = { class = "^(floorp)$", title = "^.*(YouTube).*$" },
    opacity = "1.00 1.00",
})

--------------------
---- AUDIO CONTROL ----
--------------------
hl.window_rule({
    name = "pavucontrol-float",
    match = { class = "^(pavucontrol)$" },
    float = true,
})

hl.window_rule({
    name = "pavucontrol-dim-around",
    match = { class = "^(pavucontrol)$" },
    dim_around = true,
})

hl.window_rule({
    name = "pavucontrol-move",
    match = { class = "^(pavucontrol)$" },
    move = "onscreen 100%-w-8 100%-w-48",
})

hl.window_rule({
    name = "pavucontrol-pin",
    match = { class = "^(pavucontrol)$" },
    pin = true,
})

--------------
---- DISCORD ----
--------------
hl.window_rule({
    name = "discord-open-files-float",
    match = { class = "^(discord)$", title = "^(Open Files)$" },
    float = true,
})

hl.window_rule({
    name = "discord-open-files-center",
    match = { class = "^(discord)$", title = "^(Open Files)$" },
    center = true,
})

------------------
---- GNOME BOXES ----
------------------
hl.window_rule({
    name = "gnome-boxes-size",
    match = { class = "^(org.gnome.Boxes)$", title = "^(Boxes)$", float = true },
    size = { 800, 600 },
})

hl.window_rule({
    name = "gnome-boxes-center",
    match = { class = "^(org.gnome.Boxes)$", title = "^(Boxes)$", float = true },
    center = true,
})

hl.window_rule({
    name = "gnome-boxes-media-select-float",
    match = { class = "^(org.gnome.Boxes)$", title = "^(Select a device or OS media file)$" },
    float = true,
})

hl.window_rule({
    name = "gnome-boxes-media-select-center",
    match = { class = "^(org.gnome.Boxes)$", title = "^(Select a device or OS media file)$" },
    center = true,
})

hl.window_rule({
    name = "gnome-boxes-media-select-size",
    match = { class = "^(org.gnome.Boxes)$", title = "^(Select a device or OS media file)$" },
    size = { 800, 600 },
})

--------------------
---- NETWORK CONTROL ----
--------------------
hl.window_rule({
    name = "nm-connection-editor-float",
    match = { class = "^(nm-connection-editor)$" },
    float = true,
})

hl.window_rule({
    name = "nm-connection-editor-dim-around",
    match = { class = "^(nm-connection-editor)$" },
    dim_around = true,
})

hl.window_rule({
    name = "nm-connection-editor-move",
    match = { class = "^(nm-connection-editor)$" },
    move = "onscreen 100%-w-8 100%-w-48",
})

hl.window_rule({
    name = "nm-connection-editor-pin",
    match = { class = "^(nm-connection-editor)$" },
    pin = true,
})
