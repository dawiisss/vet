#!/usr/bin/env bash

# Vet (Very Easy Terminal) installer script for Linux systems.
# Designed to be fetched and executed directly:
# curl -fsSL https://raw.githubusercontent.com/dawiisss/vet/dev/install.sh | bash

set -e

# Color helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Vet (Very Easy Terminal) installer ===${NC}"

# Define repository metadata
REPO_OWNER="dawiisss"
REPO_NAME="vet"
FALLBACK_VERSION="1.0.0"

# 1. Fetch latest release version from GitHub API
echo -e "Checking latest release version..."
LATEST_TAG=""
if command -v curl &> /dev/null; then
  LATEST_TAG=$(curl -s "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
elif command -v wget &> /dev/null; then
  LATEST_TAG=$(wget -qO- "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
fi

# Clean tag name (e.g. v1.0.0 -> 1.0.0)
if [ -z "$LATEST_TAG" ]; then
  echo -e "${YELLOW}Could not fetch latest release tag from GitHub API (rate limit or network issue).${NC}"
  echo -e "Falling back to version: v${FALLBACK_VERSION}"
  VERSION="${FALLBACK_VERSION}"
  TAG_NAME="v${FALLBACK_VERSION}"
else
  TAG_NAME="$LATEST_TAG"
  VERSION="${LATEST_TAG#v}" # removes leading 'v'
  echo -e "Found latest release: ${TAG_NAME}"
fi

# Create a temporary directory for downloads
TMP_DIR=$(mktemp -d -t vet-install-XXXXXX)
trap 'rm -rf "$TMP_DIR"' EXIT

# 2. Detect package manager and system capabilities
IS_DEB=false
IS_RPM=false
if command -v apt-get &> /dev/null || command -v dpkg &> /dev/null; then
  IS_DEB=true
elif command -v dnf &> /dev/null || command -v rpm &> /dev/null; then
  IS_RPM=true
fi

# Define URLs for release assets
BASE_DOWNLOAD_URL="https://github.com/dawiisss/vet/releases/download/${TAG_NAME}"
DEB_URL="${BASE_DOWNLOAD_URL}/vet_${VERSION}_amd64.deb"
RPM_URL="${BASE_DOWNLOAD_URL}/vet-${VERSION}.x86_64.rpm"
APPIMAGE_URL="${BASE_DOWNLOAD_URL}/Vet-${VERSION}.AppImage"

# Download helper
download_file() {
  local url="$1"
  local dest="$2"
  echo -e "Downloading $url..."
  if command -v curl &> /dev/null; then
    curl -L -o "$dest" "$url"
  elif command -v wget &> /dev/null; then
    wget -O "$dest" "$url"
  else
    echo -e "${RED}Error: Neither curl nor wget is installed.${NC}"
    exit 1
  fi
}

installed=false

# Try Debian installation
if [ "$IS_DEB" = true ]; then
  DEB_FILE="${TMP_DIR}/vet_${VERSION}_amd64.deb"
  if download_file "$DEB_URL" "$DEB_FILE"; then
    echo -e "${BLUE}Installing Debian package...${NC}"
    if command -v apt &> /dev/null; then
      sudo apt install -y "$DEB_FILE"
    else
      sudo dpkg -i "$DEB_FILE" || sudo apt-get install -f -y
    fi
    echo -e "${GREEN}Vet has been installed successfully via APT.${NC}"
    installed=true
  else
    echo -e "${YELLOW}Debian package download failed. Falling back to AppImage...${NC}"
  fi
fi

# Try RPM installation if not installed yet
if [ "$installed" = false ] && [ "$IS_RPM" = true ]; then
  RPM_FILE="${TMP_DIR}/vet-${VERSION}.x86_64.rpm"
  if download_file "$RPM_URL" "$RPM_FILE"; then
    echo -e "${BLUE}Installing RPM package...${NC}"
    if command -v dnf &> /dev/null; then
      sudo dnf install -y "$RPM_FILE"
    else
      sudo rpm -i "$RPM_FILE"
    fi
    echo -e "${GREEN}Vet has been installed successfully via RPM.${NC}"
    installed=true
  else
    echo -e "${YELLOW}RPM package download failed. Falling back to AppImage...${NC}"
  fi
fi

# Fallback: Install AppImage locally
if [ "$installed" = false ]; then
  APPIMAGE_FILE="${TMP_DIR}/Vet-${VERSION}.AppImage"
  echo -e "${BLUE}Installing Vet AppImage...${NC}"
  if download_file "$APPIMAGE_URL" "$APPIMAGE_FILE"; then
    # Create local directories
    mkdir -p "$HOME/.local/bin"
    mkdir -p "$HOME/.local/share/applications"
    mkdir -p "$HOME/.local/share/icons"

    # Copy AppImage and make executable
    DEST_APPIMAGE="$HOME/.local/bin/vet.AppImage"
    cp "$APPIMAGE_FILE" "$DEST_APPIMAGE"
    chmod +x "$DEST_APPIMAGE"

    # Set up desktop entry
    # Download icon from main repo branch
    echo -e "Setting up application shortcut..."
    ICON_URL="https://raw.githubusercontent.com/dawiisss/vet/dev/resources/icon.png"
    if ! curl -L -o "$HOME/.local/share/icons/vet.png" "$ICON_URL" 2>/dev/null; then
      wget -O "$HOME/.local/share/icons/vet.png" "$ICON_URL" &>/dev/null || true
    fi

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

    # Set up shell wrapper link in user path if possible
    ln -sf "$DEST_APPIMAGE" "$HOME/.local/bin/vet"

    echo -e "${GREEN}Vet AppImage has been installed to $DEST_APPIMAGE${NC}"
    echo -e "${GREEN}A desktop launcher has been created. You can now launch Vet from your application menu.${NC}"
    installed=true
  else
    echo -e "${RED}Error: Failed to download the AppImage asset from GitHub Releases.${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}Installation completed! You can start Vet by typing 'vet' in your terminal or launching it from your desktop menu.${NC}"
echo -e "Make sure '$HOME/.local/bin' is in your PATH."
