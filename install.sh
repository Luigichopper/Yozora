#!/usr/bin/env bash
set -e

# ==============================================================================
#  🌌 Yozora (夜空) — Arch Linux One-Line Installer
# ==============================================================================

REPO="Luigichopper/Yozora"
INSTALL_DIR="/tmp/yozora-install-$$"

echo -e "\033[1;35m==>\033[0m \033[1mFetching latest Yozora release for Arch Linux...\033[0m"

# Ensure curl and jq are available
if ! command -v curl &> /dev/null; then
    echo "Error: curl is required to install Yozora."
    exit 1
fi

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# 1. Try to fetch pre-built .pkg.tar.zst from GitHub Releases
RELEASE_JSON=$(curl -s "https://api.github.com/repos/$REPO/releases/latest")
PKG_URL=$(echo "$RELEASE_JSON" | grep -o 'https://[^"]*\.pkg\.tar\.zst' | head -n 1)

if [ -n "$PKG_URL" ]; then
    echo -e "\033[1;32m==>\033[0m Found pre-compiled release package. Downloading..."
    curl -L "$PKG_URL" -o "yozora.pkg.tar.zst"
    echo -e "\033[1;32m==>\033[0m Installing with pacman..."
    sudo pacman -U --noconfirm "yozora.pkg.tar.zst"
else
    # 2. Fallback: Clone and build via makepkg
    echo -e "\033[1;33m==>\033[0m Building from source via makepkg..."
    git clone "https://github.com/$REPO.git"
    cd Yozora/aur
    makepkg -si --noconfirm
fi

rm -rf "$INSTALL_DIR"

echo -e "\n\033[1;35m✨ Yozora successfully installed!\033[0m"
echo "Launch it anytime with: yozora"
