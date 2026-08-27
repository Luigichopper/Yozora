#!/usr/bin/env bash
# ==============================================================================
#  🌌 Yozora (夜空) — Universal Linux Installer
#  A native anime tracking, browsing, and playback client
# ==============================================================================

set -e

REPO="Luigichopper/Yozora"
GITHUB_API="https://api.github.com/repos/$REPO/releases/latest"
INSTALL_MODE="user" # "user" (default, ~/.local) or "system" (/usr/local)
PACKAGE_TYPE="auto" # "auto", "appimage", "bin", "deb", "arch", "source"
UNINSTALL=false
DRY_RUN=false

# Colors
C_RESET="\033[0m"
C_BOLD="\033[1m"
C_CYAN="\033[1;36m"
C_PURPLE="\033[1;35m"
C_GREEN="\033[1;32m"
C_YELLOW="\033[1;33m"
C_RED="\033[1;31m"

log_info() {
    echo -e "${C_PURPLE}==>${C_RESET} ${C_BOLD}$1${C_RESET}"
}

log_success() {
    echo -e "${C_GREEN}==>${C_RESET} ${C_BOLD}$1${C_RESET}"
}

log_warn() {
    echo -e "${C_YELLOW}WARNING:${C_RESET} $1"
}

log_error() {
    echo -e "${C_RED}ERROR:${C_RESET} $1"
}

print_banner() {
    echo -e "${C_CYAN}"
    echo "  🌌  __     __                           "
    echo "      \ \   / /__  _______  _ __ __ _     "
    echo "       \ \ / / _ \|_  / _ \| '__/ _\` |    "
    echo "        \ V / (_) |/ / (_) | | | (_| |    "
    echo "         \_/ \___//___\___/|_|  \__,_|    "
    echo "          夜 空  •  Anime Desktop Client   "
    echo -e "${C_RESET}"
}

show_help() {
    echo "Yozora Linux Installer"
    echo ""
    echo "Usage: ./install.sh [options]"
    echo ""
    echo "Options:"
    echo "  --user             Install into ~/.local (default, rootless, recommended)"
    echo "  --system           Install system-wide into /usr/local (requires sudo)"
    echo "  --type <type>      Force package type: auto, appimage, bin, deb, arch, source"
    echo "  --appimage         Shorthand for --type appimage"
    echo "  --bin              Shorthand for --type bin (standalone binary)"
    echo "  --deb              Shorthand for --type deb (Debian/Ubuntu package)"
    echo "  --arch             Shorthand for --type arch (Arch package .pkg.tar.zst)"
    echo "  --source           Build from source via git & cargo"
    echo "  --uninstall        Remove Yozora binary, desktop entry, and icon"
    echo "  --help, -h         Show this help message"
    echo ""
}

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --user)
            INSTALL_MODE="user"
            shift
            ;;
        --system)
            INSTALL_MODE="system"
            shift
            ;;
        --type)
            PACKAGE_TYPE="$2"
            shift 2
            ;;
        --appimage)
            PACKAGE_TYPE="appimage"
            shift
            ;;
        --bin)
            PACKAGE_TYPE="bin"
            shift
            ;;
        --deb)
            PACKAGE_TYPE="deb"
            shift
            ;;
        --arch)
            PACKAGE_TYPE="arch"
            shift
            ;;
        --source)
            PACKAGE_TYPE="source"
            shift
            ;;
        --uninstall)
            UNINSTALL=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Distro Detection
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO_ID="${ID:-unknown}"
        DISTRO_LIKE="${ID_LIKE:-unknown}"
        DISTRO_NAME="${NAME:-Linux}"
    else
        DISTRO_ID="unknown"
        DISTRO_LIKE="unknown"
        DISTRO_NAME="Linux"
    fi

    ARCH=$(uname -m)
    if [ "$ARCH" != "x86_64" ] && [ "$ARCH" != "aarch64" ]; then
        log_warn "Architecture '$ARCH' detected. Prebuilt binaries are optimized for x86_64/aarch64."
    fi
}

# Setup install target directories
setup_dirs() {
    if [ "$INSTALL_MODE" = "system" ]; then
        BIN_DIR="/usr/local/bin"
        DESKTOP_DIR="/usr/share/applications"
        ICON_DIR="/usr/share/icons/hicolor/scalable/apps"
        SUDO_CMD="sudo"
    else
        BIN_DIR="${HOME}/.local/bin"
        DESKTOP_DIR="${HOME}/.local/share/applications"
        ICON_DIR="${HOME}/.local/share/icons/hicolor/scalable/apps"
        SUDO_CMD=""
    fi

    mkdir -p "$BIN_DIR" "$DESKTOP_DIR" "$ICON_DIR"
}

# Uninstallation Routine
uninstall_yozora() {
    print_banner
    log_info "Uninstalling Yozora from system..."

    # Check user locations
    rm -f "${HOME}/.local/bin/yozora"
    rm -f "${HOME}/.local/share/applications/yozora.desktop"
    rm -f "${HOME}/.local/share/icons/hicolor/scalable/apps/yozora.svg"

    # Check system locations if root/sudo available
    if [ "$EUID" -eq 0 ] || command -v sudo &>/dev/null; then
        $SUDO_CMD rm -f "/usr/local/bin/yozora" "/usr/bin/yozora" 2>/dev/null || true
        $SUDO_CMD rm -f "/usr/share/applications/yozora.desktop" "/usr/local/share/applications/yozora.desktop" 2>/dev/null || true
        $SUDO_CMD rm -f "/usr/share/icons/hicolor/scalable/apps/yozora.svg" 2>/dev/null || true
    fi

    # Update caches if available
    command -v update-desktop-database &>/dev/null && update-desktop-database "${HOME}/.local/share/applications" 2>/dev/null || true
    command -v gtk-update-icon-cache &>/dev/null && gtk-update-icon-cache -f -t "${HOME}/.local/share/icons/hicolor" 2>/dev/null || true

    log_success "Yozora has been successfully uninstalled."
    exit 0
}

# Dependency checks and installation suggestions
check_dependencies() {
    local missing_deps=()
    
    if ! command -v mpv &>/dev/null; then
        missing_deps+=("mpv")
    fi

    # Check WebKitGTK / GTK3 runtime presence
    if [ "$DISTRO_ID" = "arch" ] || [[ "$DISTRO_LIKE" == *"arch"* ]]; then
        if ! pacman -Q webkit2gtk-4.1 &>/dev/null && ! pacman -Q webkit2gtk &>/dev/null; then
            missing_deps+=("webkit2gtk-4.1")
        fi
    elif [ "$DISTRO_ID" = "ubuntu" ] || [ "$DISTRO_ID" = "debian" ] || [[ "$DISTRO_LIKE" == *"debian"* ]] || [[ "$DISTRO_LIKE" == *"ubuntu"* ]]; then
        if ! dpkg -l libwebkit2gtk-4.1-0 &>/dev/null && ! dpkg -l libwebkit2gtk-4.0-37 &>/dev/null; then
            missing_deps+=("libwebkit2gtk-4.1-0")
        fi
    elif [ "$DISTRO_ID" = "fedora" ] || [[ "$DISTRO_LIKE" == *"fedora"* ]]; then
        if ! rpm -q webkit2gtk4.1 &>/dev/null; then
            missing_deps+=("webkit2gtk4.1")
        fi
    fi

    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo ""
        log_warn "Some recommended runtime dependencies were not detected: ${missing_deps[*]}"
        echo -e "To ensure full video playback and UI rendering, install them with:"
        
        if [ "$DISTRO_ID" = "arch" ] || [[ "$DISTRO_LIKE" == *"arch"* ]]; then
            echo -e "  ${C_CYAN}sudo pacman -S --needed mpv webkit2gtk-4.1 gtk3${C_RESET}"
        elif [ "$DISTRO_ID" = "ubuntu" ] || [ "$DISTRO_ID" = "debian" ] || [[ "$DISTRO_LIKE" == *"debian"* ]]; then
            echo -e "  ${C_CYAN}sudo apt install mpv libwebkit2gtk-4.1-0 libgtk-3-0${C_RESET}"
        elif [ "$DISTRO_ID" = "fedora" ] || [[ "$DISTRO_LIKE" == *"fedora"* ]]; then
            echo -e "  ${C_CYAN}sudo dnf install mpv webkit2gtk4.1 gtk3${C_RESET}"
        elif [ "$DISTRO_ID" = "opensuse" ] || [[ "$DISTRO_LIKE" == *"suse"* ]]; then
            echo -e "  ${C_CYAN}sudo zypper install mpv libwebkit2gtk-4_1-0 gtk3${C_RESET}"
        fi
        echo ""
    fi
}

install_desktop_integration() {
    local target_bin="$1"
    log_info "Setting up desktop integration & application icon..."

    # 1. Install Icon
    local icon_src="https://raw.githubusercontent.com/$REPO/main/public/logo.svg"
    curl -fsSL "$icon_src" -o "$ICON_DIR/yozora.svg" 2>/dev/null || true

    # 2. Install Desktop Entry
    cat <<EOF > "$DESKTOP_DIR/yozora.desktop"
[Desktop Entry]
Name=Yozora
GenericName=Anime Tracking & Playback Client
Comment=Material 3 Quickshell-inspired anime client with Matugen theming and AniDB metadata
Exec=$target_bin %u
Icon=yozora
Terminal=false
Type=Application
Categories=AudioVideo;Player;TV;
StartupWMClass=yozora
MimeType=x-scheme-handler/magnet;x-scheme-handler/anidb;
Keywords=anime;anidb;player;hyprland;wayland;
EOF

    chmod +x "$DESKTOP_DIR/yozora.desktop"

    # 3. Refresh desktop databases if tools available
    command -v update-desktop-database &>/dev/null && update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
    command -v gtk-update-icon-cache &>/dev/null && gtk-update-icon-cache -f -t "$(dirname "$(dirname "$ICON_DIR")")" 2>/dev/null || true
}

# Main Execution Flow
main() {
    print_banner

    if [ "$UNINSTALL" = true ]; then
        uninstall_yozora
    fi

    detect_distro
    setup_dirs

    log_info "Detected OS: ${C_CYAN}${DISTRO_NAME}${C_RESET} (${ARCH})"
    log_info "Installation Target: ${C_CYAN}${INSTALL_MODE}${C_RESET} mode -> ${BIN_DIR}"

    # Required tool checks
    if ! command -v curl &>/dev/null; then
        log_error "'curl' is required. Please install curl and re-run."
        exit 1
    fi

    TMP_DIR=$(mktemp -d /tmp/yozora-install-XXXXXX)
    trap 'rm -rf "$TMP_DIR"' EXIT
    cd "$TMP_DIR"

    # Fetch latest release data from GitHub API
    log_info "Querying latest release from GitHub ($REPO)..."
    RELEASE_JSON=$(curl -s "$GITHUB_API" || echo "{}")

    # Determine best package format if auto
    if [ "$PACKAGE_TYPE" = "auto" ]; then
        if [ "$DISTRO_ID" = "arch" ] || [[ "$DISTRO_LIKE" == *"arch"* ]]; then
            PACKAGE_TYPE="arch"
        elif [ "$DISTRO_ID" = "ubuntu" ] || [ "$DISTRO_ID" = "debian" ] || [[ "$DISTRO_LIKE" == *"debian"* ]]; then
            PACKAGE_TYPE="deb"
        else
            PACKAGE_TYPE="appimage"
        fi
    fi

    INSTALLED=false

    # 1. ARCH LINUX PACKAGE (.pkg.tar.zst)
    if [ "$PACKAGE_TYPE" = "arch" ] && [ "$INSTALLED" = false ]; then
        PKG_URL=$(echo "$RELEASE_JSON" | grep -o 'https://[^"]*\.pkg\.tar\.zst' | head -n 1 || true)
        if [ -n "$PKG_URL" ]; then
            log_info "Found pre-built Arch Linux package (.pkg.tar.zst). Downloading..."
            curl -L "$PKG_URL" -o "yozora.pkg.tar.zst"
            log_info "Installing package with pacman..."
            $SUDO_CMD pacman -U --noconfirm --needed "yozora.pkg.tar.zst"
            INSTALLED=true
        elif command -v yay &>/dev/null; then
            log_info "Building & installing via yay..."
            yay -S --noconfirm yozora-git || true
            INSTALLED=true
        elif command -v paru &>/dev/null; then
            log_info "Building & installing via paru..."
            paru -S --noconfirm yozora-git || true
            INSTALLED=true
        else
            log_warn "Pre-built .pkg.tar.zst not found in release. Trying AppImage / binary fallback..."
            PACKAGE_TYPE="appimage"
        fi
    fi

    # 2. DEBIAN / UBUNTU PACKAGE (.deb)
    if [ "$PACKAGE_TYPE" = "deb" ] && [ "$INSTALLED" = false ]; then
        DEB_URL=$(echo "$RELEASE_JSON" | grep -o 'https://[^"]*amd64\.deb' | head -n 1 || echo "$RELEASE_JSON" | grep -o 'https://[^"]*\.deb' | head -n 1 || true)
        if [ -n "$DEB_URL" ]; then
            log_info "Found Debian/Ubuntu (.deb) package. Downloading..."
            curl -L "$DEB_URL" -o "yozora.deb"
            log_info "Installing package with apt/dpkg..."
            $SUDO_CMD apt-get update -qq && $SUDO_CMD apt-get install -y ./yozora.deb || $SUDO_CMD dpkg -i yozora.deb || true
            INSTALLED=true
        else
            log_warn "Pre-built .deb not found in release. Trying AppImage / binary fallback..."
            PACKAGE_TYPE="appimage"
        fi
    fi

    # 3. UNIVERSAL APPIMAGE
    if [ "$PACKAGE_TYPE" = "appimage" ] && [ "$INSTALLED" = false ]; then
        APPIMAGE_URL=$(echo "$RELEASE_JSON" | grep -o 'https://[^"]*\.AppImage' | head -n 1 || true)
        if [ -n "$APPIMAGE_URL" ]; then
            log_info "Found Universal Linux AppImage. Downloading..."
            curl -L "$APPIMAGE_URL" -o "$BIN_DIR/yozora"
            chmod +x "$BIN_DIR/yozora"
            install_desktop_integration "$BIN_DIR/yozora"
            INSTALLED=true
        else
            PACKAGE_TYPE="bin"
        fi
    fi

    # 4. STANDALONE BINARY FALLBACK
    if [ "$PACKAGE_TYPE" = "bin" ] && [ "$INSTALLED" = false ]; then
        BIN_URL=$(echo "$RELEASE_JSON" | grep -o 'https://[^"]*yozora-linux-[^"]*' | head -n 1 || true)
        if [ -n "$BIN_URL" ]; then
            log_info "Found pre-built standalone Linux binary. Downloading..."
            curl -L "$BIN_URL" -o "$BIN_DIR/yozora"
            chmod +x "$BIN_DIR/yozora"
            install_desktop_integration "$BIN_DIR/yozora"
            INSTALLED=true
        fi
    fi

    # 5. BUILD FROM SOURCE FALLBACK
    if [ "$INSTALLED" = false ] || [ "$PACKAGE_TYPE" = "source" ]; then
        log_info "Building Yozora from source repository..."
        if ! command -v git &>/dev/null || ! command -v cargo &>/dev/null || ! command -v npm &>/dev/null; then
            log_error "To build from source, git, npm (Node.js), and cargo (Rust) are required."
            exit 1
        fi

        git clone "https://github.com/$REPO.git" yozora-src
        cd yozora-src
        log_info "Building frontend..."
        npm install
        npm run build
        log_info "Building Tauri native backend..."
        cd src-tauri
        cargo build --release --locked
        
        cp target/release/yozora "$BIN_DIR/yozora"
        chmod +x "$BIN_DIR/yozora"
        install_desktop_integration "$BIN_DIR/yozora"
        INSTALLED=true
    fi

    # Check PATH environment for user installs
    if [ "$INSTALL_MODE" = "user" ]; then
        if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
            echo ""
            log_warn "Note: '$HOME/.local/bin' is not currently in your \$PATH."
            echo "Add the following line to your ~/.bashrc or ~/.zshrc:"
            echo -e "  ${C_CYAN}export PATH=\"\$HOME/.local/bin:\$PATH\"${C_RESET}"
        fi
    fi

    check_dependencies

    echo ""
    log_success "✨ Yozora successfully installed!"
    echo -e "Launch it from your desktop application launcher or run: ${C_CYAN}yozora${C_RESET}"
    echo ""
}

main

