# Writes the Nix defaults into KeePassXC's settings file, which its settings
# window also writes. A managed key changed there since the last run becomes
# an override in the state directory and keeps its value; deleting
# overrides.ini restores the defaults. KeePassXC reads the file when it
# starts, so this runs before it.
#
# usage: merge-settings DEFAULTS SETTINGS STATE_DIR

import configparser
import os
import sys
import tempfile

defaults_path, settings_path, state_dir = sys.argv[1:]
applied_path = os.path.join(state_dir, "applied.ini")
overrides_path = os.path.join(state_dir, "overrides.ini")


def read(path):
    parser = configparser.ConfigParser(
        interpolation=None,
        strict=False,
        delimiters=("=",),
        comment_prefixes=(),
        empty_lines_in_values=False,
    )
    parser.optionxform = str
    parser.read(path, encoding="utf-8")
    return parser


def flat(parser):
    return {
        (section, key): value
        for section in parser.sections()
        for key, value in parser.items(section, raw=True)
    }


def assign(parser, values):
    for (section, key), value in values.items():
        if not parser.has_section(section):
            parser.add_section(section)
        parser.set(section, key, value)
    return parser


def write(path, parser):
    directory = os.path.dirname(path)
    os.makedirs(directory, exist_ok=True)
    exists = os.path.exists(path)
    mode = os.stat(path).st_mode & 0o777 if exists else 0o600
    descriptor, temporary = tempfile.mkstemp(dir=directory)
    with os.fdopen(descriptor, "w", encoding="utf-8") as file:
        parser.write(file, space_around_delimiters=False)
    os.chmod(temporary, mode)
    os.replace(temporary, path)


defaults = flat(read(defaults_path))
settings = read(settings_path)
current = flat(settings)
overrides = flat(read(overrides_path))

for key, written in flat(read(applied_path)).items():
    value = current.get(key)
    if value is None or value == written:
        continue
    if value == defaults.get(key):
        overrides.pop(key, None)
    else:
        overrides[key] = value

overrides = {
    key: value for key, value in overrides.items() if key in defaults
}
effective = {
    key: overrides.get(key, value) for key, value in defaults.items()
}

write(settings_path, assign(settings, effective))
write(overrides_path, assign(read(os.devnull), overrides))
write(applied_path, assign(read(os.devnull), effective))
