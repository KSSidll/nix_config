# To do

Making the apps work together rather than each on its own.

Done:

- Text and code files open in Neovim, and terminal apps open in a window of the running Ghostty.
- KeePassXC has its own module and starts with the session in the tray. Its settings are Nix defaults with UI overrides.
- KeePassXC is the Secret Service in place of gnome-keyring. Apps' deletions wait for your confirmation.
- KeePassXC loads the SSH key from the vault into gcr's agent when the vault unlocks; the private key file is gone from
  `~/.ssh`. Its file dialogs are GTK's, since the portal refuses KeePassXC's requests.
- The vault syncs cleanly: a save on mainpc while it was open on the laptop reloaded there without a conflict copy.
  Edits on two devices before they sync still make one, which the overlay's conflict notification reports, and
  KeePassXC's Database → Merge from database folds it back in.
- Zen fills logins from the vault through KeePassXC-Browser. Its add-ons are declared in the Zen module and
  force-installed from addons.mozilla.org; undeclared ones can still be installed by hand.

## KeePassXC as the one secrets store

### Integrations

- **Vault layout:**
  - Groups work with all the integrations: the browser matches by URL across the whole database, and SSH keys load per entry.
  - The Secret Service exposes one group, where apps also create their entries; an "Apps" group keeps those apart from your logins.

### Quick Unlock, once nixpkgs has KeePassXC 2.8

Both package sets have 2.7.12 (checked on 2026-10-25). 2.8.0 adds Polkit Quick Unlock on Linux; wait for nixpkgs
rather than packaging 2.8 here, since it moves to Qt 6 with new dependencies.

How it behaves:

- The first unlock after KeePassXC starts takes the master password.
- After that, KeePassXC keeps the database key in memory, encrypted, with its decryption key in the kernel keyring.
- Later unlocks ask polkit (`org.keepassxc.KeePassXC.unlockDatabase`), so the overlay's polkit agent asks for the user
  password.
- Nothing is written to disk, and it lasts until KeePassXC exits.

To do:

- **Lock sooner:** 5 minutes idle (`Security/LockDatabaseIdleSeconds = 300`).
- **Turn it on:** `Security/QuickUnlock`, on by default. Check that the polkit action's policy file reaches
  `/run/current-system/sw/share/polkit-1/actions`.
- **A password every time:** a polkit rule (`security.polkit.extraConfig`) answering `AUTH_SELF` for
  `org.keepassxc.KeePassXC.unlockDatabase`, so no earlier authorisation is reused.
  - Together with the 5-minute idle lock, any fill more than 5 minutes after the vault was last used asks for the user password.
  - Fills in quick succession share one confirmation.
- **The master password again after 8 hours:**
  - Quick Unlock has no expiry, and only a restart clears it.
  - A user timer, every 15 minutes, restarts KeePassXC's service once it has run 8 hours (`ActiveEnterTimestamp`) and
    the vault is locked (the collection's `Locked` property in the Secret Service).
  - It never restarts KeePassXC while the vault is open.

## Keys for frequent actions

Only Mod+Return (terminal) and Mod+D (launcher) are bound. Candidates:

- Print for an area screenshot.
- Keys for the browser, Files and the editor.
- Mod+V for Vicinae's clipboard history, and a key for its emoji picker.

## After a screenshot

niri saves the screenshot and copies it without telling you. The overlay should post a notification with **Open**,
**Annotate** and **Show in Files**.

- **Annotate** needs an annotation tool: `satty` (arrows, boxes, blur, then save or copy).
- The alternative is `swappy`, which is simpler and older.

## Projects

- **A Vicinae command:** search the git repos under `~/dev` and open one in Zed, a terminal there, Claude Code there,
  or Files.
  - It should warn when the repo is still syncing, using the Syncthing indicator's state.
- **zoxide** (`zoxide`) in zsh and yazi, to jump to a directory by part of its name.

## Smaller

- **Window rules:** KeePassXC or Vesktop floating, or opening on a set workspace.
- **Open in Terminal:** a Ghostty entry in Nautilus's right-click menu, from the `nautilus-open-any-terminal` extension.
