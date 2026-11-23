#!/usr/bin/env python3
"""Validate and safely extract an uploaded ZIP. No uploaded scripts are executed here."""
import os, pathlib, stat, sys, zipfile

if len(sys.argv) != 3:
    raise SystemExit("Usage: safe_extract.py source.zip output_dir")
archive, destination = sys.argv[1], pathlib.Path(sys.argv[2]).resolve()
MAX_FILES = 10000
MAX_UNCOMPRESSED = 1024 * 1024 * 1024
MAX_RATIO = 250

def safe_target(name):
    p = pathlib.PurePosixPath(name)
    if p.is_absolute() or ".." in p.parts or "\\" in name or (p.parts and ":" in p.parts[0]):
        raise ValueError(f"Unsafe ZIP path: {name}")
    target = (destination / pathlib.Path(*p.parts)).resolve()
    if target != destination and destination not in target.parents:
        raise ValueError(f"ZIP path escapes destination: {name}")
    return target

with zipfile.ZipFile(archive) as z:
    entries = z.infolist()
    if len(entries) > MAX_FILES:
        raise SystemExit("ZIP contains too many entries.")
    total = sum(i.file_size for i in entries)
    if total > MAX_UNCOMPRESSED:
        raise SystemExit("ZIP uncompressed size exceeds 1 GB.")
    for item in entries:
        safe_target(item.filename)
        mode = (item.external_attr >> 16) & 0xFFFF
        if stat.S_ISLNK(mode):
            raise SystemExit(f"Symbolic links are not allowed: {item.filename}")
        if item.file_size > 0 and item.compress_size == 0:
            raise SystemExit("Suspicious ZIP entry with zero compressed size.")
        if item.compress_size and item.file_size / item.compress_size > MAX_RATIO:
            raise SystemExit(f"Suspicious compression ratio: {item.filename}")
    destination.mkdir(parents=True, exist_ok=True)
    for item in entries:
        target = safe_target(item.filename)
        if item.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(item) as src, open(target, "wb") as dst:
                while True:
                    chunk = src.read(1024 * 1024)
                    if not chunk: break
                    dst.write(chunk)
print(f"Extracted {len(entries)} entries safely to {destination}")
