#!/usr/bin/env bash

# Vet (Very Easy Terminal) installer script for Linux systems.
# This script detects your package manager, builds the distribution packages if missing,
# and installs the optimal package format.

set -e

# Color helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Vet (Very Easy Terminal) Linux Installer ===${NC}"

# 1. Determine local path
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

# 2. Check for build artifacts. If missing, offer to build.
check_and_build() {
  if [ ! -d "dist" ] || [ -z "$(ls -A dist/*.deb dist/*.rpm dist/*.AppImage dist/*.tar.gz 2>/dev/null)" ]; then
    echo -e "${YELLOW}No pre-built Vet packages found in dist/.${NC}"
    echo -e "Would you like to build them now? (Requires Node.js and npm installed) [Y/n]"
    read -r build_choice
    if [[ "$build_choice" =~ ^[Nn]$ ]]; then
      echo -e "${RED}Installation aborted. Please build Vet using 'npm run dist:linux' first.${NC}"
      exit 1
    fi

    echo -e "${BLUE}Installing dependencies and building Vet packages...${NC}"
    npm install
    # Remove cpu-features if present, as it can fail compilation on newer Electron/node versions
    rm -rf node_modules/cpu-features
    npm run dist:linux
    echo -e "${GREEN}Build completed successfully!${NC}"
  fi
}

check_and_build

# 3. Detect package manager and system capabilities
IS_DEB=false
IS_RPM=false
if command -v apt-get &> /dev/null || command -v dpkg &> /dev/null; then
  IS_DEB=true
elif command -v dnf &> /dev/null || command -v rpm &> /dev/null; then
  IS_RPM=true
fi

# 4. Install matching format
DEB_FILE=$(find dist -name "vet_*_amd64.deb" | head -n 1)
RPM_FILE=$(find dist -name "vet-*.x86_64.rpm" | head -n 1)
APPIMAGE_FILE=$(find dist -name "Vet-*.AppImage" | head -n 1)
TARBALL_FILE=$(find dist -name "vet-*.tar.gz" | head -n 1)

installed=false

# Try Debian package
if [ "$IS_DEB" = true ] && [ -n "$DEB_FILE" ]; then
  echo -e "${BLUE}Detected Debian-based system. Installing Debian package: $DEB_FILE...${NC}"
  if command -v apt &> /dev/null; then
    sudo apt install -y "./$DEB_FILE"
  else
    sudo dpkg -i "$DEB_FILE" || sudo apt-get install -f -y
  fi
  echo -e "${GREEN}Vet has been installed successfully via APT.${NC}"
  installed=true

# Try RPM package
elif [ "$IS_RPM" = true ] && [ -n "$RPM_FILE" ]; then
  echo -e "${BLUE}Detected RedHat/RPM-based system. Installing RPM package: $RPM_FILE...${NC}"
  if command -v dnf &> /dev/null; then
    sudo dnf install -y "$RPM_FILE"
  else
    sudo rpm -i "$RPM_FILE"
  fi
  echo -e "${GREEN}Vet has been installed successfully via RPM.${NC}"
  installed=true
fi

# Fallback: Install AppImage locally if package installation was skipped or not supported
if [ "$installed" = false ]; then
  if [ -n "$APPIMAGE_FILE" ]; then
    echo -e "${BLUE}Installing Vet AppImage to user directory...${NC}"
    
    # Create local bin if it doesn't exist
    mkdir -p "$HOME/.local/bin"
    mkdir -p "$HOME/.local/share/applications"
    mkdir -p "$HOME/.local/share/icons"

    # Copy AppImage and make executable
    DEST_APPIMAGE="$HOME/.local/bin/vet.AppImage"
    cp "$APPIMAGE_FILE" "$DEST_APPIMAGE"
    chmod +x "$DEST_APPIMAGE"

    # Extract icon for desktop entry
    echo -e "Setting up application shortcut..."
    cp resources/icon.png "$HOME/.local/share/icons/vet.png" 2>/dev/null || true

    # Create desktop entry
    cat <<EOF > "$HOME/.local/share/applications/vet.desktop"
[Desktop Entry]
Name=Vet
Comment=Very Easy Terminal Emulator
Exec=$DEST_APPIMAGE
Icon=vet
Terminal=false
Type=Application
Categories=Utility;TerminalEmulator;System;
StartupWMClass=vet
EOF

    chmod +x "$HOME/.local/share/applications/vet.desktop"

    echo -e "${GREEN}Vet AppImage has been installed to $DEST_APPIMAGE${NC}"
    echo -e "${GREEN}A desktop launcher has been created. You can now launch Vet from your application menu.${NC}"
    installed=true
  else
    echo -e "${RED}Error: Could not find any package or AppImage to install.${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}Installation completed! You can start Vet by typing 'vet' in your terminal or launching it from your desktop menu.${NC}"
