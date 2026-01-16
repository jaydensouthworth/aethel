{
  description = "Codex - Writing IDE";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ (import rust-overlay) ];
        pkgs = import nixpkgs { inherit system overlays; };
        
        # Tauri 2 needs these system libraries
        libraries = with pkgs; [
          webkitgtk_4_1
          gtk3
          cairo
          gdk-pixbuf
          glib
          dbus
          openssl
          librsvg
        ];
        
        buildInputs = with pkgs; [
          # Rust
          (rust-bin.stable.latest.default.override {
            extensions = [ "rust-src" "rust-analyzer" ];
            targets = [ "wasm32-unknown-unknown" ]; # if you want WASM later
          })
          cargo-tauri
          
          # Node
          nodejs_20
          pnpm # or nodePackages.npm if you prefer npm
          
          # Build tools
          pkg-config
          gobject-introspection
          
          # Tauri deps
          webkitgtk_4_1
          gtk3
          libsoup_3
          glib-networking
        ];
      in
      {
        devShells.default = pkgs.mkShell {
          inherit buildInputs;
          
          # Runtime library path for Tauri
          LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath libraries;
          
          # For openssl-sys
          PKG_CONFIG_PATH = "${pkgs.openssl.dev}/lib/pkgconfig";
          
          # GIO needs this for HTTPS
          GIO_MODULE_DIR = "${pkgs.glib-networking}/lib/gio/modules";
          
          shellHook = ''
            echo "Codex dev environment loaded"
            echo "Node: $(node --version)"
            echo "Rust: $(rustc --version)"
            echo "Tauri CLI: $(cargo tauri --version)"
          '';
        };
      }
    );
}
