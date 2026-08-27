# ==============================================================================
#  🌌 Yozora (夜空) — Linux Makefile
# ==============================================================================

PREFIX ?= $(HOME)/.local
BINDIR ?= $(PREFIX)/bin
DATADIR ?= $(PREFIX)/share
APPDIR ?= $(DATADIR)/applications
ICONDIR ?= $(DATADIR)/icons/hicolor/scalable/apps

.PHONY: all help dev build bundle install install-system uninstall install-deps package-arch clean

all: build

help:
	@echo "🌌 Yozora Linux Build & Installation Commands:"
	@echo ""
	@echo "  make dev             Start local Vite development server"
	@echo "  make build           Build frontend & compile release binary"
	@echo "  make bundle          Build full release bundles (AppImage + DEB via Tauri)"
	@echo "  make install-deps    Auto-detect Linux distro & install required dependencies"
	@echo "  make install         Install yozora, desktop entry & icon to $(PREFIX)"
	@echo "  make install-system  Install system-wide to /usr/local (requires sudo)"
	@echo "  make uninstall       Uninstall yozora from $(PREFIX)"
	@echo "  make package-arch    Build Arch Linux .pkg.tar.zst via makepkg"
	@echo "  make clean           Clean build artifacts"
	@echo ""

# Auto-install build & runtime dependencies for detected Linux distro
install-deps:
	@if [ -f /etc/os-release ]; then \
		. /etc/os-release; \
		if [ "$$ID" = "arch" ] || echo "$$ID_LIKE" | grep -q "arch"; then \
			echo "Installing Arch Linux dependencies..."; \
			sudo pacman -S --needed base-devel nodejs npm rust cargo git webkit2gtk-4.1 gtk3 mpv; \
		elif [ "$$ID" = "ubuntu" ] || [ "$$ID" = "debian" ] || echo "$$ID_LIKE" | grep -q "debian"; then \
			echo "Installing Debian/Ubuntu dependencies..."; \
			sudo apt-get update && sudo apt-get install -y build-essential nodejs npm cargo rustc git libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf libssl-dev mpv; \
		elif [ "$$ID" = "fedora" ] || echo "$$ID_LIKE" | grep -q "fedora"; then \
			echo "Installing Fedora dependencies..."; \
			sudo dnf install -y gcc-c++ nodejs npm cargo rust git webkit2gtk4.1-devel gtk3-devel libappindicator-gtk3-devel librsvg2-devel openssl-devel mpv; \
		elif [ "$$ID" = "opensuse" ] || echo "$$ID_LIKE" | grep -q "suse"; then \
			echo "Installing openSUSE dependencies..."; \
			sudo zypper install -y gcc-c++ nodejs npm cargo rust git libwebkit2gtk-4_1-devel gtk3-devel libappindicator3-devel librsvg-devel openssl-devel mpv; \
		else \
			echo "Unrecognized distro. Please ensure Node.js, Rust, webkit2gtk-4.1, GTK3, and mpv are installed."; \
		fi; \
	fi

dev:
	npm run dev

build:
	npm install
	npm run build
	cd src-tauri && cargo build --release --locked

bundle:
	npm install
	npm run build
	npx @tauri-apps/cli@1 build

install:
	@echo "Installing Yozora to $(PREFIX)..."
	mkdir -p $(DESTDIR)$(BINDIR)
	mkdir -p $(DESTDIR)$(APPDIR)
	mkdir -p $(DESTDIR)$(ICONDIR)
	install -Dm755 src-tauri/target/release/yozora $(DESTDIR)$(BINDIR)/yozora
	install -Dm644 aur/yozora.desktop $(DESTDIR)$(APPDIR)/yozora.desktop
	install -Dm644 public/logo.svg $(DESTDIR)$(ICONDIR)/yozora.svg
	@command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database $(DESTDIR)$(APPDIR) || true
	@command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -f -t $(DESTDIR)$(DATADIR)/icons/hicolor || true
	@echo "✨ Yozora successfully installed to $(BINDIR)/yozora!"

install-system:
	$(MAKE) install PREFIX=/usr/local

uninstall:
	@echo "Removing Yozora from $(PREFIX)..."
	rm -f $(DESTDIR)$(BINDIR)/yozora
	rm -f $(DESTDIR)$(APPDIR)/yozora.desktop
	rm -f $(DESTDIR)$(ICONDIR)/yozora.svg
	@command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database $(DESTDIR)$(APPDIR) || true
	@command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -f -t $(DESTDIR)$(DATADIR)/icons/hicolor || true
	@echo "✨ Yozora uninstalled from $(PREFIX)."

package-arch:
	cd aur && makepkg -si --noconfirm

clean:
	rm -rf dist
	rm -rf src-tauri/target/release/yozora
	rm -rf src-tauri/target/release/bundle
	rm -rf aur/*.pkg.tar.zst
