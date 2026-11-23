#!/usr/bin/env python3
"""Find exactly one Gradle Android project root containing gradlew."""
import pathlib, sys
root = pathlib.Path(sys.argv[1]).resolve()
candidates = sorted(p.parent for p in root.rglob("gradlew") if p.is_file() and ".git" not in p.parts)
if not candidates:
    raise SystemExit("No gradlew found. Upload a native Android Gradle project with its Gradle wrapper included.")
# Prefer the shallowest candidate, but fail if multiple independent roots share the same depth.
candidates.sort(key=lambda p: (len(p.relative_to(root).parts), str(p)))
shallow = len(candidates[0].relative_to(root).parts)
nearest = [p for p in candidates if len(p.relative_to(root).parts) == shallow]
if len(nearest) != 1:
    raise SystemExit("Multiple Gradle project roots found. Repackage the ZIP with one intended project root.")
print(nearest[0])
