#!/usr/bin/env bash
#
# This script installs a tool into ~/.local/bin, avoiding any sudo prompt.
#

set -euo pipefail

# ----- Configuration -----

# Your GitHub org/username and repository name
REPO_OWNER="Positive-LLC"
REPO_NAME="gpt-files"

# The command name the user will run
INSTALL_NAME="gpt-files"

# Where to install in the user's home directory
INSTALL_DIR="${HOME}/.local/bin"

# The 4 filenames in the release:
#  - arm64-linux
#  - arm64-macos
#  - x86_64-linux
#  - x86_64-macos

# ----- Detect OS & Arch -----

OS=$(uname -s)
ARCH=$(uname -m)

# Normalize OS to either "linux" or "macos"
case "$OS" in
  Linux*)   OS_TYPE="linux" ;;
  Darwin*)  OS_TYPE="macos" ;;
  *)        echo "Unsupported OS: $OS"; exit 1 ;;
esac

# Normalize ARCH to either "x86_64" or "arm64"
case "$ARCH" in
  x86_64)                 ARCH_TYPE="x86_64" ;;
  aarch64|arm64)          ARCH_TYPE="arm64"  ;;
  *)                      echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

FILENAME="${REPO_NAME}-${ARCH_TYPE}-${OS_TYPE}"

echo "Detected OS=$OS_TYPE, ARCH=$ARCH_TYPE"
echo "Using release asset: $FILENAME"

# ----- Download from GitHub Release -----
# This uses the "latest" release. For a specific version, replace "latest" with "v1.2.3"
DOWNLOAD_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/${FILENAME}"

# Create the install dir if not present
mkdir -p "$INSTALL_DIR"

echo "Downloading $DOWNLOAD_URL ..."
curl -fL --progress-bar -o "/tmp/${FILENAME}" "$DOWNLOAD_URL"
chmod +x "/tmp/${FILENAME}"

# ----- Move to ~/.local/bin -----

echo "Installing ${FILENAME} to ${INSTALL_DIR}/${INSTALL_NAME}"
mv "/tmp/${FILENAME}" "${INSTALL_DIR}/${INSTALL_NAME}"

# ----- Check PATH -----
# If ~/.local/bin is not in PATH, remind the user to add it.

if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
  echo
  echo "WARNING: $INSTALL_DIR is not in your PATH!"
  echo "Add the following line to your ~/.bashrc or ~/.zshrc (whichever applies):"
  echo
  echo "  export PATH=\"\$PATH:$INSTALL_DIR\""
  echo
  echo "Then open a new terminal or run: source ~/.bashrc (or ~/.zshrc)."
fi

echo
echo "Successfully installed '${INSTALL_NAME}' to '${INSTALL_DIR}/${INSTALL_NAME}'"
echo "Run '${INSTALL_NAME} --help' to get started!"
