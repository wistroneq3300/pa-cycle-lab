#!/bin/sh
set -eu

repo_root=$(git rev-parse --show-toplevel)
git -C "$repo_root" config core.hooksPath .githooks
chmod +x "$repo_root/.githooks/pre-commit"
printf '%s\n' 'Installed PA Cycle Lab Git hooks from .githooks.'
