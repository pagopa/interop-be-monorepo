#!/bin/bash
GROUP_PACKAGES="$1"
for pkg in $GROUP_PACKAGES; do
  pnpm test --dir packages/$pkg --pool=threads --maxConcurrency=8
done
