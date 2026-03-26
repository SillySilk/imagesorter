import sys
import os
import shutil
import json
import tkinter as tk
from tkinter import filedialog, messagebox
from PIL import Image, ImageTk
import copy
import random
import io

class ConfigManager:
    """Manages application configuration with validation, migration, and persistence."""

    DEFAULT_SORT_SETTINGS = {
        "button_mappings": {"left_click": "keep", "right_click": "reject", "middle_click": "disabled"},
        "wheel_mappings": {"wheel_up": "previous", "wheel_down": "next"},
        "key_mappings": {"space": "random", "Up": "zoom_in", "Down": "zoom_out", "f": "fit_to_page"}
    }

    DEFAULT_VIEW_SETTINGS = {
        "button_mappings": {"left_click": "next", "right_click": "previous", "middle_click": "random"},
        "wheel_mappings": {"wheel_up": "previous", "wheel_down": "next"},
        "key_mappings": {"Up": "zoom_in", "Down": "zoom_out", "f": "fit_to_page", "space": "random"}
    }

    DEFAULT_CONFIG = {
        "src": "",
        "keep": "",
        "app_mode": "view",
        "sort_settings": {
            "button_mappings": {"left_click": "keep", "right_click": "reject", "middle_click": "disabled"},
            "wheel_mappings": {"wheel_up": "previous", "wheel_down": "next"},
            "key_mappings": {"space": "random", "Up": "zoom_in", "Down": "zoom_out", "f": "fit_to_page"}
        },
        "view_settings": {
            "button_mappings": {"left_click": "next", "right_click": "previous", "middle_click": "random"},
            "wheel_mappings": {"wheel_up": "previous", "wheel_down": "next"},
            "key_mappings": {"Up": "zoom_in", "Down": "zoom_out", "f": "fit_to_page", "space": "random"}
        },
        "options": {
            "recursive_loading": False
        }
    }

    VALID_ACTIONS = {"keep", "reject", "next", "previous", "skip", "disabled", "random",
                     "zoom_in", "zoom_out", "fit_to_page"}

    def __init__(self, config_file="culler_settings.json"):
        self.config_file = config_file
        self.config = self.load()

    def load(self):
        """Load config from file, migrate if needed, return defaults if missing."""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    data = json.load(f)

                    # Validate loaded config
                    is_valid, error_msg = self.validate(data)
                    if is_valid:
                        # Migrate if needed
                        return self.migrate(data)
                    else:
                        raise ValueError(f"Invalid config schema: {error_msg}")

            except (FileNotFoundError, json.JSONDecodeError, ValueError) as e:
                print(f"Config error: {e}. Using defaults.")
                messagebox.showwarning(
                    "Settings Error",
                    "Could not load settings. Using defaults."
                )
                return copy.deepcopy(self.DEFAULT_CONFIG)

        # File doesn't exist, return defaults
        return copy.deepcopy(self.DEFAULT_CONFIG)

    def save(self, config):
        """Validate and save config to file."""
        is_valid, error_msg = self.validate(config)
        if not is_valid:
            print(f"Cannot save invalid config: {error_msg}")
            return False

        try:
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)
            self.config = config
            return True
        except Exception as e:
            print(f"Failed to save settings: {e}")
            return False

    def validate(self, config):
        """Validate config structure, return (is_valid, error_message)."""
        if not isinstance(config, dict):
            return False, "Config must be a dictionary"

        # v1 config (no button_mappings, no sort_settings): valid for migration
        if "src" in config and "keep" in config and "button_mappings" not in config and "sort_settings" not in config:
            return True, ""

        # Old v2-v4 format (button_mappings at top level): valid for migration
        if "button_mappings" in config and "sort_settings" not in config:
            if not isinstance(config["button_mappings"], dict):
                return False, "button_mappings must be a dictionary"
            for key in ("left_click", "right_click"):
                if key not in config["button_mappings"]:
                    return False, f"Missing button mapping: {key}"
                if config["button_mappings"][key] not in self.VALID_ACTIONS:
                    return False, f"Invalid action for {key}"
            return True, ""  # Will be migrated to v5

        # New v5 format: requires sort_settings and view_settings
        for key in ("src", "keep", "sort_settings", "view_settings", "options"):
            if key not in config:
                return False, f"Missing required key: {key}"

        # Validate each mode's settings block
        for mode in ("sort", "view"):
            skey = f"{mode}_settings"
            s = config[skey]
            if not isinstance(s, dict):
                return False, f"{skey} must be a dictionary"

            bm = s.get("button_mappings", {})
            if not isinstance(bm, dict):
                return False, f"{skey}.button_mappings must be a dictionary"
            for k in ("left_click", "right_click"):
                if k not in bm:
                    return False, f"Missing {skey}.button_mappings.{k}"
                if bm[k] not in self.VALID_ACTIONS:
                    return False, f"Invalid action '{bm[k]}' in {skey}.button_mappings.{k}"
            # middle_click is optional
            if "middle_click" in bm and bm["middle_click"] not in self.VALID_ACTIONS:
                return False, f"Invalid action '{bm['middle_click']}' in {skey}.button_mappings.middle_click"

            wm = s.get("wheel_mappings", {})
            if not isinstance(wm, dict):
                return False, f"{skey}.wheel_mappings must be a dictionary"
            for k in ("wheel_up", "wheel_down"):
                if k not in wm:
                    return False, f"Missing {skey}.wheel_mappings.{k}"
                if wm[k] not in self.VALID_ACTIONS:
                    return False, f"Invalid action '{wm[k]}' in {skey}.wheel_mappings.{k}"

            km = s.get("key_mappings", {})
            if not isinstance(km, dict):
                return False, f"{skey}.key_mappings must be a dictionary"
            for key_name, action in km.items():
                if action not in self.VALID_ACTIONS:
                    return False, f"Invalid action '{action}' for key '{key_name}' in {skey}"

        # Validate options
        if not isinstance(config["options"], dict):
            return False, "options must be a dictionary"
        if "recursive_loading" not in config["options"]:
            return False, "Missing option: recursive_loading"
        if not isinstance(config["options"]["recursive_loading"], bool):
            return False, "recursive_loading must be a boolean"

        # Validate app_mode (optional)
        if "app_mode" in config and config["app_mode"] not in ("sort", "view"):
            return False, "app_mode must be 'sort' or 'view'"

        return True, ""

    def migrate(self, old_config):
        """Migrate old config format to new schema."""
        migrated = False

        # v1 to v2 migration (no button_mappings)
        if "button_mappings" not in old_config:
            print("Migrating config from v1 to v2 format...")
            new_config = copy.deepcopy(self.DEFAULT_CONFIG)
            new_config["src"] = old_config.get("src", "")
            new_config["keep"] = old_config.get("keep", "")
            old_config = new_config
            migrated = True

        # v2 to v3 migration (add key_mappings if missing)
        if "key_mappings" not in old_config and "sort_settings" not in old_config:
            print("Migrating config: adding key_mappings...")
            old_config["key_mappings"] = copy.deepcopy(self.DEFAULT_SORT_SETTINGS["key_mappings"])
            migrated = True

        # v3 to v4 migration (flip key_mappings from {function: key} to {key: action})
        if "key_mappings" in old_config and "sort_settings" not in old_config:
            km = old_config["key_mappings"]
            old_function_keys = {"random_image", "zoom_in", "zoom_out", "fit_to_page"}
            if old_function_keys & set(km.keys()):
                print("Migrating config: flipping key_mappings to {key: action} format...")
                function_to_action = {
                    "random_image": "random", "zoom_in": "zoom_in",
                    "zoom_out": "zoom_out", "fit_to_page": "fit_to_page"
                }
                new_km = {}
                for func_name, key_name in km.items():
                    action = function_to_action.get(func_name, func_name)
                    new_km[key_name] = action
                old_config["key_mappings"] = new_km
                migrated = True

        # v4 to v5 migration: move flat mappings into sort_settings, add default view_settings
        if "button_mappings" in old_config and "sort_settings" not in old_config:
            print("Migrating config: restructuring to per-mode settings (v5)...")
            old_config["sort_settings"] = {
                "button_mappings": old_config.pop("button_mappings"),
                "wheel_mappings": old_config.pop("wheel_mappings", copy.deepcopy(self.DEFAULT_SORT_SETTINGS["wheel_mappings"])),
                "key_mappings": old_config.pop("key_mappings", copy.deepcopy(self.DEFAULT_SORT_SETTINGS["key_mappings"]))
            }
            old_config["view_settings"] = copy.deepcopy(self.DEFAULT_VIEW_SETTINGS)
            migrated = True

        # Ensure view_settings exists (in case of partial migration)
        if "sort_settings" in old_config and "view_settings" not in old_config:
            old_config["view_settings"] = copy.deepcopy(self.DEFAULT_VIEW_SETTINGS)
            migrated = True

        # v5 to v6 migration: add middle_click if missing
        for mode in ("sort", "view"):
            skey = f"{mode}_settings"
            if skey in old_config:
                bm = old_config[skey].get("button_mappings", {})
                if "middle_click" not in bm:
                    defaults = self.DEFAULT_SORT_SETTINGS if mode == "sort" else self.DEFAULT_VIEW_SETTINGS
                    bm["middle_click"] = defaults["button_mappings"]["middle_click"]
                    migrated = True

        if migrated:
            self.save(old_config)

        return old_config

    def get(self, key_path, default=None):
        """Get config value by dot notation (e.g., 'button_mappings.left_click')."""
        keys = key_path.split('.')
        value = self.config

        try:
            for key in keys:
                value = value[key]
            return value
        except (KeyError, TypeError):
            return default

    def set(self, key_path, value):
        """Set config value by dot notation."""
        keys = key_path.split('.')
        config = self.config

        # Navigate to the parent of the target key
        for key in keys[:-1]:
            if key not in config:
                config[key] = {}
            config = config[key]

        # Set the final key
        config[keys[-1]] = value

class ActionMapper:
    """Manages dynamic event binding and action routing based on configuration."""

    ACTIONS = {
        "keep": "action_keep",
        "reject": "action_reject",
        "next": "action_next",
        "previous": "action_previous",
        "skip": "action_skip",
        "random": "action_random",
        "zoom_in": "zoom_in",
        "zoom_out": "zoom_out",
        "fit_to_page": "fit_to_page",
        "disabled": None
    }

    def __init__(self, app_instance):
        """Initialize ActionMapper with reference to RapidCullerApp instance."""
        self.app = app_instance
        self.current_bindings = {}
        self.key_bindings = {}  # Track keyboard bindings on root

    def bind_all(self, config):
        """Bind all events based on the current mode's settings."""
        self.unbind_all()

        # Get mode-specific settings block; fall back to flat config for old formats
        mode = self.app.app_mode
        settings = config.get(f"{mode}_settings", config)

        self._bind_buttons(settings.get("button_mappings", {}))
        self._bind_wheel(settings.get("wheel_mappings", {}))
        self._bind_keys(settings.get("key_mappings", {}))

    def unbind_all(self):
        """Remove all current bindings."""
        image_label = self.app.image_label

        # Unbind all previously bound mouse events
        for event_type in self.current_bindings:
            try:
                image_label.unbind(event_type)
            except:
                pass  # Ignore errors if binding doesn't exist

        self.current_bindings.clear()

        # Unbind keyboard events from root
        root = self.app.root
        for event_type in self.key_bindings:
            try:
                root.unbind(event_type)
            except:
                pass
        self.key_bindings.clear()

    def _bind_buttons(self, button_config):
        """Bind mouse button events."""
        image_label = self.app.image_label

        # Left click - use pan-aware handler for zoom support
        left_action = button_config.get("left_click", "keep")
        if left_action != "disabled":
            image_label.bind("<ButtonPress-1>", self.app._on_left_click)
            image_label.bind("<B1-Motion>", self.app._on_pan_motion)
            image_label.bind("<ButtonRelease-1>", self.app._on_left_release)
            self.current_bindings["<ButtonPress-1>"] = left_action
            self.current_bindings["<B1-Motion>"] = "pan"
            self.current_bindings["<ButtonRelease-1>"] = "pan_end"

        # Right click (Button-3)
        right_action = button_config.get("right_click", "reject")
        if right_action != "disabled":
            handler = self._create_handler(right_action)
            if handler:
                image_label.bind("<Button-3>", handler)
                self.current_bindings["<Button-3>"] = right_action

        # Middle click (Button-2)
        middle_action = button_config.get("middle_click", "disabled")
        if middle_action != "disabled":
            handler = self._create_handler(middle_action)
            if handler:
                image_label.bind("<Button-2>", handler)
                self.current_bindings["<Button-2>"] = middle_action

    def _bind_wheel(self, wheel_config):
        """Bind mouse wheel events."""
        image_label = self.app.image_label

        # Get actions for both directions
        wheel_up_action = wheel_config.get("wheel_up", "previous")
        wheel_down_action = wheel_config.get("wheel_down", "next")

        # Create handlers
        wheel_up_handler = None if wheel_up_action == "disabled" else self._create_handler(wheel_up_action)
        wheel_down_handler = None if wheel_down_action == "disabled" else self._create_handler(wheel_down_action)

        # Bind Windows/MacOS wheel event (single binding handles both directions)
        if wheel_up_handler or wheel_down_handler:
            combined_handler = self._create_combined_wheel_handler(wheel_up_handler, wheel_down_handler)
            image_label.bind("<MouseWheel>", combined_handler)
            self.current_bindings["<MouseWheel>"] = f"{wheel_up_action}/{wheel_down_action}"

        # Bind Linux wheel events (separate buttons for up/down)
        if wheel_up_handler:
            image_label.bind("<Button-4>", wheel_up_handler)
            self.current_bindings["<Button-4>"] = wheel_up_action

        if wheel_down_handler:
            image_label.bind("<Button-5>", wheel_down_handler)
            self.current_bindings["<Button-5>"] = wheel_down_action

    def _bind_keys(self, key_config):
        """Bind keyboard events based on key_mappings config ({key: action} format)."""
        root = self.app.root

        for key_name, action_name in key_config.items():
            if action_name == "disabled":
                continue

            # Convert key name to tkinter event string
            key_name = key_name.strip()
            if key_name.lower() == "space":
                event_str = "<space>"
            else:
                event_str = f"<{key_name}>"

            handler = self._create_handler(action_name)
            if handler:
                root.bind(event_str, handler)
                self.key_bindings[event_str] = action_name

    def _create_handler(self, action_name):
        """Create event handler that calls appropriate action method."""
        if action_name not in self.ACTIONS:
            print(f"Warning: Unknown action '{action_name}'")
            return None

        method_name = self.ACTIONS[action_name]
        if method_name is None:  # disabled action
            return None

        # Get the method from the app instance
        if hasattr(self.app, method_name):
            method = getattr(self.app, method_name)
            return method
        else:
            print(f"Warning: Method '{method_name}' not found on app instance")
            return None

    def _create_combined_wheel_handler(self, up_handler, down_handler):
        """Create combined wheel handler for Windows/MacOS that handles both directions."""
        def wheel_handler(event):
            # Ctrl+Wheel always zooms, regardless of configured mappings
            if event.state & 0x0004:  # Ctrl key held
                if event.delta > 0:
                    self.app.zoom_in(event)
                elif event.delta < 0:
                    self.app.zoom_out(event)
                return
            # On Windows/MacOS, event.delta indicates scroll direction
            # Positive delta = scroll up, Negative delta = scroll down
            if event.delta > 0 and up_handler:
                up_handler(event)
            elif event.delta < 0 and down_handler:
                down_handler(event)
        return wheel_handler

class RecursiveScanner:
    """Scans directory tree for images, maintaining structure information."""

    VALID_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.bmp', '.webp', '.psd')

    @staticmethod
    def scan(root_dir, recursive=False):
        """
        Scan directory for images.

        Returns list of dicts with structure:
        {
            "filename": "image.png",
            "relative_path": "subdir/image.png",  # Empty string for root files
            "full_path": "/path/to/root/subdir/image.png"
        }
        """
        if recursive:
            return RecursiveScanner._scan_recursive(root_dir)
        else:
            return RecursiveScanner._scan_flat(root_dir)

    @staticmethod
    def _scan_flat(root_dir):
        """Scan only root directory (current behavior)."""
        results = []

        try:
            for filename in os.listdir(root_dir):
                full_path = os.path.join(root_dir, filename)

                # Skip directories
                if os.path.isfile(full_path) and RecursiveScanner._is_valid_image(filename):
                    results.append({
                        "filename": filename,
                        "relative_path": "",
                        "full_path": full_path
                    })
        except (FileNotFoundError, PermissionError) as e:
            print(f"Error scanning directory {root_dir}: {e}")

        return results

    @staticmethod
    def _scan_recursive(root_dir):
        """Use os.walk to scan recursively."""
        results = []

        for dirpath, dirnames, filenames in os.walk(root_dir):
            # Skip symlinks to prevent infinite loops
            dirnames[:] = [d for d in dirnames if not os.path.islink(os.path.join(dirpath, d))]

            try:
                for filename in filenames:
                    if RecursiveScanner._is_valid_image(filename):
                        full_path = os.path.join(dirpath, filename)
                        rel_path = os.path.relpath(dirpath, root_dir)

                        # Set to empty string if in root directory
                        if rel_path == ".":
                            rel_path = ""

                        results.append({
                            "filename": filename,
                            "relative_path": rel_path,
                            "full_path": full_path
                        })
            except PermissionError as e:
                print(f"Permission denied: {dirpath}")
                continue  # Skip this directory

        return results

    @staticmethod
    def _is_valid_image(filename):
        """Check if filename has valid image extension."""
        return filename.lower().endswith(RecursiveScanner.VALID_EXTENSIONS)

class SettingsDialog:
    """Modal dialog for configuring application settings (tabbed by mode)."""

    def __init__(self, parent, config_manager, app_mode="sort"):
        self.parent = parent
        self.config_manager = config_manager
        self.app_mode = app_mode
        self.dialog = None
        self.notebook = None
        self.temp_config = {}

        # Per-mode widget storage
        self.mode_widgets = {"sort": {}, "view": {}}
        self.key_mapping_rows = {"sort": [], "view": []}
        self.key_mappings_frames = {"sort": None, "view": None}
        self.key_add_btns = {"sort": None, "view": None}

        # Shared action display/value maps
        self.key_action_options = [
            "Keep", "Reject", "Next", "Previous", "Skip", "Random",
            "Zoom In", "Zoom Out", "Fit to Page", "Disabled"
        ]
        self.key_action_display_to_value = {
            "Keep": "keep", "Reject": "reject", "Next": "next",
            "Previous": "previous", "Skip": "skip", "Random": "random",
            "Zoom In": "zoom_in", "Zoom Out": "zoom_out",
            "Fit to Page": "fit_to_page", "Disabled": "disabled"
        }
        self.key_action_value_to_display = {v: k for k, v in self.key_action_display_to_value.items()}

    def _get_mode_settings(self, mode):
        """Get the settings dict for a given mode from temp_config."""
        return self.temp_config.get(f"{mode}_settings", {})

    def _build_mode_tab(self, parent, mode):
        """Build button/wheel/key sections + per-tab reset button."""
        self._build_button_mappings_section(parent, mode)
        self._build_wheel_mappings_section(parent, mode)
        self._build_key_mappings_section(parent, mode)

        # Per-tab reset button
        reset_frame = tk.Frame(parent)
        reset_frame.pack(fill="x", padx=10, pady=(5, 10))
        label = "Sort / Cull" if mode == "sort" else "View Only"
        tk.Button(
            reset_frame, text=f"Reset {label} Defaults",
            bg="#6c757d", fg="white",
            command=lambda m=mode: self._reset_tab_to_defaults(m)
        ).pack(side="left")

    def _build_button_mappings_section(self, parent_frame, mode):
        """Build button mapping controls for a mode."""
        frame = tk.LabelFrame(parent_frame, text="Button Mappings", padx=10, pady=10)
        frame.pack(fill="x", padx=10, pady=5)
        action_options = ["Keep", "Reject", "Next", "Previous", "Skip", "Random", "Disabled"]
        settings = self._get_mode_settings(mode)

        tk.Label(frame, text="Left Click:", anchor="w").grid(row=0, column=0, sticky="w", padx=5, pady=5)
        left_var = tk.StringVar(self.dialog)
        left_var.set(settings.get("button_mappings", {}).get("left_click", "keep").capitalize())
        left_menu = tk.OptionMenu(frame, left_var, *action_options)
        left_menu.config(width=12)
        left_menu.grid(row=0, column=1, sticky="w", padx=5, pady=5)
        self.mode_widgets[mode]["left_click"] = left_var

        tk.Label(frame, text="Right Click:", anchor="w").grid(row=1, column=0, sticky="w", padx=5, pady=5)
        right_var = tk.StringVar(self.dialog)
        right_var.set(settings.get("button_mappings", {}).get("right_click", "reject").capitalize())
        right_menu = tk.OptionMenu(frame, right_var, *action_options)
        right_menu.config(width=12)
        right_menu.grid(row=1, column=1, sticky="w", padx=5, pady=5)
        self.mode_widgets[mode]["right_click"] = right_var

        tk.Label(frame, text="Middle Click:", anchor="w").grid(row=2, column=0, sticky="w", padx=5, pady=5)
        middle_var = tk.StringVar(self.dialog)
        middle_var.set(settings.get("button_mappings", {}).get("middle_click", "disabled").capitalize())
        middle_menu = tk.OptionMenu(frame, middle_var, *action_options)
        middle_menu.config(width=12)
        middle_menu.grid(row=2, column=1, sticky="w", padx=5, pady=5)
        self.mode_widgets[mode]["middle_click"] = middle_var

    def _build_wheel_mappings_section(self, parent_frame, mode):
        """Build wheel mapping controls for a mode."""
        frame = tk.LabelFrame(parent_frame, text="Mouse Wheel Mappings", padx=10, pady=10)
        frame.pack(fill="x", padx=10, pady=5)
        action_options = ["Keep", "Reject", "Next", "Previous", "Skip", "Random", "Disabled"]
        settings = self._get_mode_settings(mode)

        tk.Label(frame, text="Wheel Up:", anchor="w").grid(row=0, column=0, sticky="w", padx=5, pady=5)
        up_var = tk.StringVar(self.dialog)
        up_var.set(settings.get("wheel_mappings", {}).get("wheel_up", "previous").capitalize())
        up_menu = tk.OptionMenu(frame, up_var, *action_options)
        up_menu.config(width=12)
        up_menu.grid(row=0, column=1, sticky="w", padx=5, pady=5)
        self.mode_widgets[mode]["wheel_up"] = up_var

        tk.Label(frame, text="Wheel Down:", anchor="w").grid(row=1, column=0, sticky="w", padx=5, pady=5)
        down_var = tk.StringVar(self.dialog)
        down_var.set(settings.get("wheel_mappings", {}).get("wheel_down", "next").capitalize())
        down_menu = tk.OptionMenu(frame, down_var, *action_options)
        down_menu.config(width=12)
        down_menu.grid(row=1, column=1, sticky="w", padx=5, pady=5)
        self.mode_widgets[mode]["wheel_down"] = down_var

    def _build_key_mappings_section(self, parent_frame, mode):
        """Build keyboard mapping controls for a mode."""
        frame = tk.LabelFrame(parent_frame, text="Keyboard Mappings", padx=10, pady=10)
        frame.pack(fill="x", padx=10, pady=5)
        self.key_mappings_frames[mode] = frame

        settings = self._get_mode_settings(mode)
        for key_name, action_name in settings.get("key_mappings", {}).items():
            self._add_key_mapping_row(mode, key_name, action_name)

        add_btn = tk.Button(frame, text="+ Add Key Binding",
                            command=lambda m=mode: self._add_empty_key_mapping_row(m))
        add_btn.grid(row=100, column=0, columnspan=5, pady=(5, 0))
        self.key_add_btns[mode] = add_btn

    def _add_key_mapping_row(self, mode, key_name="", action_name="disabled"):
        """Add a single key mapping row for a given mode."""
        frame = self.key_mappings_frames[mode]
        row_idx = len(self.key_mapping_rows[mode])

        key_var = tk.StringVar(self.dialog, value=key_name)
        entry = tk.Entry(frame, textvariable=key_var, width=12, justify="center", state="readonly")
        entry.grid(row=row_idx, column=0, sticky="w", padx=(5, 2), pady=3)

        set_btn = tk.Button(frame, text="Set",
                            command=lambda e=entry, v=key_var: self._capture_key(e, v))
        set_btn.grid(row=row_idx, column=1, padx=2, pady=3)

        action_label = tk.Label(frame, text="Action:")
        action_label.grid(row=row_idx, column=2, padx=(5, 2), pady=3)

        action_display = self.key_action_value_to_display.get(action_name, "Disabled")
        action_var = tk.StringVar(self.dialog, value=action_display)
        action_menu = tk.OptionMenu(frame, action_var, *self.key_action_options)
        action_menu.config(width=10)
        action_menu.grid(row=row_idx, column=3, padx=2, pady=3)

        remove_btn = tk.Button(frame, text="\u2715", width=2)
        row_data = {"key_var": key_var, "action_var": action_var,
                    "widgets": [entry, set_btn, action_label, action_menu, remove_btn]}
        remove_btn.config(command=lambda rd=row_data, m=mode: self._remove_key_mapping_row(m, rd))
        remove_btn.grid(row=row_idx, column=4, padx=2, pady=3)

        self.key_mapping_rows[mode].append(row_data)

    def _add_empty_key_mapping_row(self, mode):
        """Add an empty key mapping row and prompt for key capture."""
        self._add_key_mapping_row(mode, "", "disabled")
        new_row = self.key_mapping_rows[mode][-1]
        self._capture_key(new_row["widgets"][0], new_row["key_var"])

    def _remove_key_mapping_row(self, mode, row_data):
        """Remove a key mapping row from the UI."""
        if row_data in self.key_mapping_rows[mode]:
            self.key_mapping_rows[mode].remove(row_data)
            for w in row_data["widgets"]:
                w.destroy()
            self._relayout_key_mapping_rows(mode)

    def _relayout_key_mapping_rows(self, mode):
        """Re-grid all key mapping rows after a removal."""
        for idx, row_data in enumerate(self.key_mapping_rows[mode]):
            ws = row_data["widgets"]
            ws[0].grid(row=idx, column=0, sticky="w", padx=(5, 2), pady=3)
            ws[1].grid(row=idx, column=1, padx=2, pady=3)
            ws[2].grid(row=idx, column=2, padx=(5, 2), pady=3)
            ws[3].grid(row=idx, column=3, padx=2, pady=3)
            ws[4].grid(row=idx, column=4, padx=2, pady=3)

    def _capture_key(self, entry, var):
        """Capture a key press and set it as the binding."""
        entry.config(state="normal")
        entry.delete(0, tk.END)
        entry.insert(0, "Press a key...")
        entry.config(state="readonly")

        def on_key(event):
            key_name = event.keysym
            var.set(key_name)
            entry.config(state="normal")
            entry.delete(0, tk.END)
            entry.insert(0, key_name)
            entry.config(state="readonly")
            self.dialog.unbind("<Key>")

        self.dialog.bind("<Key>", on_key)
        self.dialog.focus_set()

    def _build_options_section(self, parent_frame):
        """Build shared loading options."""
        frame = tk.LabelFrame(parent_frame, text="Loading Options", padx=10, pady=10)
        frame.pack(fill="x", padx=10, pady=5)

        recursive_var = tk.BooleanVar(self.dialog)
        recursive_var.set(self.temp_config.get("options", {}).get("recursive_loading", False))
        tk.Checkbutton(frame, text="Load images from subdirectories recursively",
                       variable=recursive_var).pack(anchor="w", padx=5, pady=5)
        self.mode_widgets["_shared"] = {"recursive_loading": recursive_var}

    def _build_button_bar(self, parent_frame):
        """Build dialog button bar (Cancel + Save)."""
        frame = tk.Frame(parent_frame, padx=10, pady=10)
        frame.pack(fill="x", side="bottom")

        tk.Button(frame, text="Cancel", bg="#6c757d", fg="white",
                  command=self._cancel).pack(side="right", padx=5)
        tk.Button(frame, text="Save", bg="#28a745", fg="white",
                  font=("Arial", 10, "bold"),
                  command=self._validate_and_save).pack(side="right", padx=5)

    def show(self):
        """Display modal settings dialog."""
        import tkinter.ttk as ttk
        self.dialog = tk.Toplevel(self.parent)
        self.dialog.title("Settings")
        self.dialog.geometry("570x660")
        self.dialog.transient(self.parent)
        self.dialog.grab_set()

        self.temp_config = copy.deepcopy(self.config_manager.config)

        # Button bar at bottom
        self._build_button_bar(self.dialog)

        # Shared loading options
        self._build_options_section(self.dialog)

        # Tabbed notebook for mode-specific settings
        self.notebook = ttk.Notebook(self.dialog)
        self.notebook.pack(fill="both", expand=True, padx=10, pady=5)

        for mode, label in [("sort", "  Sort / Cull  "), ("view", "  View Only  ")]:
            tab = tk.Frame(self.notebook)
            self.notebook.add(tab, text=label)
            self._build_mode_tab(tab, mode)

        # Open to the tab matching current mode
        self.notebook.select(0 if self.app_mode == "sort" else 1)

        self.dialog.wait_window()

    def _collect_mode_settings(self, mode):
        """Read widget values for a mode and return a settings dict."""
        w = self.mode_widgets[mode]
        key_mappings = {}
        for row_data in self.key_mapping_rows[mode]:
            key_name = row_data["key_var"].get().strip()
            action_value = self.key_action_display_to_value.get(row_data["action_var"].get(), "disabled")
            if key_name:
                key_mappings[key_name] = action_value
        return {
            "button_mappings": {
                "left_click": w["left_click"].get().lower(),
                "right_click": w["right_click"].get().lower(),
                "middle_click": w["middle_click"].get().lower(),
            },
            "wheel_mappings": {
                "wheel_up": w["wheel_up"].get().lower(),
                "wheel_down": w["wheel_down"].get().lower(),
            },
            "key_mappings": key_mappings
        }

    def _validate_and_save(self):
        """Collect settings from both tabs, validate, and save."""
        self.temp_config["sort_settings"] = self._collect_mode_settings("sort")
        self.temp_config["view_settings"] = self._collect_mode_settings("view")
        self.temp_config["options"]["recursive_loading"] = \
            self.mode_widgets["_shared"]["recursive_loading"].get()

        is_valid, error_msg = self.config_manager.validate(self.temp_config)
        if not is_valid:
            messagebox.showerror("Invalid Settings", error_msg)
            return

        warnings = self._check_warnings(self.temp_config)
        if warnings:
            if not messagebox.askyesno("Configuration Warning", f"{warnings}\n\nProceed anyway?"):
                return

        if self.config_manager.save(self.temp_config):
            self.parent.apply_config(self.temp_config)
            self.dialog.destroy()
        else:
            messagebox.showerror("Save Failed", "Could not save settings. Check console for errors.")

    def _check_warnings(self, config):
        """Return warning messages for potentially problematic configs."""
        warnings = []
        sort_s = config.get("sort_settings", {})
        sort_actions = (
            list(sort_s.get("button_mappings", {}).values()) +
            list(sort_s.get("wheel_mappings", {}).values()) +
            list(sort_s.get("key_mappings", {}).values())
        )
        if "keep" not in sort_actions and "reject" not in sort_actions:
            warnings.append("Sort/Cull tab: no inputs mapped to Keep or Reject.\nYou won't be able to sort images!")

        for mode in ("sort", "view"):
            keys = list(config.get(f"{mode}_settings", {}).get("key_mappings", {}).keys())
            if len(keys) != len(set(keys)):
                warnings.append(f"Duplicate keys in {mode} keyboard mappings.")

        return "\n".join(warnings) if warnings else None

    def _cancel(self):
        """Close dialog without saving."""
        self.dialog.destroy()

    def _reset_tab_to_defaults(self, mode):
        """Reset the given mode tab to its factory defaults."""
        defaults = copy.deepcopy(
            ConfigManager.DEFAULT_SORT_SETTINGS if mode == "sort" else ConfigManager.DEFAULT_VIEW_SETTINGS
        )
        w = self.mode_widgets[mode]
        w["left_click"].set(defaults["button_mappings"]["left_click"].capitalize())
        w["right_click"].set(defaults["button_mappings"]["right_click"].capitalize())
        w["middle_click"].set(defaults["button_mappings"]["middle_click"].capitalize())
        w["wheel_up"].set(defaults["wheel_mappings"]["wheel_up"].capitalize())
        w["wheel_down"].set(defaults["wheel_mappings"]["wheel_down"].capitalize())

        # Rebuild key rows for this tab
        for row_data in self.key_mapping_rows[mode][:]:
            for widget in row_data["widgets"]:
                widget.destroy()
        self.key_mapping_rows[mode].clear()
        for widget in self.key_mappings_frames[mode].winfo_children():
            if widget != self.key_add_btns[mode]:
                widget.destroy()
        for key_name, action_name in defaults["key_mappings"].items():
            self._add_key_mapping_row(mode, key_name, action_name)

class RapidCullerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Rapid Image Culler for Datasets")
        self.root.geometry("800x700")
        self.root.minsize(600, 500)

        # --- Variables ---
        self.config_file = "culler_settings.json"
        self.config_manager = ConfigManager(self.config_file)
        self.src_dir = ""
        self.keep_dir = ""
        self.reject_dir = ""
        self.image_files = []
        self.current_index = 0
        self.photo_image = None # Keep reference to avoid garbage collection
        self.app_mode = "view"  # "sort" or "view"

        # Zoom and pan state
        self.zoom_level = 1.0
        self.zoom_step = 0.25
        self.min_zoom = 0.1
        self.max_zoom = 10.0
        self.pan_offset = [0, 0]
        self.panning = False
        self.pan_start = None
        self.drag_distance = 0
        self.current_pil_image = None  # Cache the full-size PIL image
        self.crop_mode = False  # Whether crop selection is active
        self.crop_rect = None   # Canvas rectangle ID
        self.crop_start = None  # (x, y) start of crop selection

        # --- GUI Layout ---

        # Top Control Panel
        control_frame = tk.Frame(root, padx=10, pady=10, bg="#e1e1e1")
        control_frame.pack(fill="x")

        # Mode Toggle (top row)
        mode_frame = tk.Frame(control_frame, bg="#e1e1e1")
        mode_frame.grid(row=0, column=0, columnspan=3, sticky="we", padx=5, pady=(2, 4))
        tk.Label(mode_frame, text="MODE:", bg="#e1e1e1", font=("Arial", 9, "bold")).pack(side="left")
        self.btn_mode_sort = tk.Button(
            mode_frame, text="Sort / Cull", font=("Arial", 9),
            bg="#d9d9d9", fg="#333",
            command=lambda: self.set_mode("sort"), takefocus=False
        )
        self.btn_mode_sort.pack(side="left", padx=(5, 2))
        self.btn_mode_view = tk.Button(
            mode_frame, text="View Only", font=("Arial", 9, "bold"),
            bg="#17a2b8", fg="white",
            command=lambda: self.set_mode("view"), takefocus=False
        )
        self.btn_mode_view.pack(side="left", padx=2)

        # Source Button and Label
        btn_src = tk.Button(control_frame, text="1. Select SOURCE Folder", bg="#d9d9d9", command=self.select_src, takefocus=False)
        btn_src.grid(row=1, column=0, sticky="w", padx=5, pady=5)
        self.lbl_src = tk.Label(control_frame, text="No folder selected", bg="#e1e1e1", anchor="w")
        self.lbl_src.grid(row=1, column=1, sticky="we", padx=5)

        # Keep Button and Label (hidden in View mode)
        self.btn_keep = tk.Button(control_frame, text="2. Select KEEP Destination", bg="#d9d9d9", command=self.select_keep, takefocus=False)
        self.btn_keep.grid(row=2, column=0, sticky="w", padx=5, pady=5)
        self.lbl_keep = tk.Label(control_frame, text="No folder selected", bg="#e1e1e1", anchor="w")
        self.lbl_keep.grid(row=2, column=1, sticky="we", padx=5)
        # Hide keep row by default since View mode is default
        self.btn_keep.grid_remove()
        self.lbl_keep.grid_remove()

        # Load Button
        self.btn_load = tk.Button(control_frame, text="2. BROWSE IMAGES", bg="#28a745", fg="white", font=("Arial", 11, "bold"), state="disabled", command=self.load_images_start, takefocus=False)
        self.btn_load.grid(row=3, column=0, columnspan=2, sticky="we", padx=5, pady=(10,5))

        # Settings Button
        btn_settings = tk.Button(control_frame, text="⚙ Settings", bg="#6c757d", fg="white", command=self.open_settings, takefocus=False)
        btn_settings.grid(row=3, column=2, sticky="e", padx=5, pady=(10,5))

        control_frame.columnconfigure(1, weight=1)

        # Instructions Area
        instr_frame = tk.Frame(root, bg="#f0f0f0", padx=10, pady=5)
        instr_frame.pack(fill="x")
        tk.Label(instr_frame, text="INSTRUCTIONS:", font=("Arial", 9, "bold"), bg="#f0f0f0").pack(side="left")
        self.lbl_instructions = tk.Label(instr_frame, text="", bg="#f0f0f0", fg="#555")
        self.lbl_instructions.pack(side="left", padx=10)
        self.lbl_status = tk.Label(instr_frame, text="Waiting to start...", font=("Arial", 9), bg="#f0f0f0", fg="blue")
        self.lbl_status.pack(side="right")

        # Zoom Toolbar
        zoom_bar = tk.Frame(root, bg="#dcdcdc", padx=6, pady=4)
        zoom_bar.pack(fill="x")
        tk.Label(zoom_bar, text="Zoom:", bg="#dcdcdc", font=("Arial", 9)).pack(side="left", padx=(2, 4))
        tk.Button(zoom_bar, text=" - ", font=("Arial", 10, "bold"), bg="#d0d0d0",
                  relief="raised", command=lambda: self.zoom_out(None), takefocus=False).pack(side="left", padx=2)
        tk.Button(zoom_bar, text=" + ", font=("Arial", 10, "bold"), bg="#d0d0d0",
                  relief="raised", command=lambda: self.zoom_in(None), takefocus=False).pack(side="left", padx=2)
        tk.Button(zoom_bar, text="Fit", font=("Arial", 9), bg="#d0d0d0",
                  relief="raised", command=lambda: self.fit_to_page(None), takefocus=False).pack(side="left", padx=(2, 8))
        self.lbl_zoom_level = tk.Label(zoom_bar, text="Fit", bg="#dcdcdc", fg="#555", font=("Arial", 9))
        self.lbl_zoom_level.pack(side="left")
        tk.Button(zoom_bar, text="Copy", font=("Arial", 9), bg="#d0d0d0",
                  relief="raised", command=self.copy_to_clipboard, takefocus=False).pack(side="right", padx=2)
        self.btn_crop_copy = tk.Button(zoom_bar, text="Crop+Copy", font=("Arial", 9), bg="#d0d0d0",
                  relief="raised", command=self.start_crop_copy, takefocus=False)
        self.btn_crop_copy.pack(side="right", padx=2)

        # Main Image Display Area
        self.image_frame = tk.Frame(root, bg="#333333")
        self.image_frame.pack(fill="both", expand=True)
        
        self.image_label = tk.Label(self.image_frame, text="Load folders to begin", bg="#333333", fg="#888888")
        self.image_label.pack(fill="both", expand=True)

        # Click anywhere on the image area to reclaim focus for key bindings
        self.image_label.bind("<ButtonRelease-1>", lambda e: self.root.focus_set(), add=True)
        self.image_label.bind("<ButtonRelease-3>", lambda e: self.root.focus_set(), add=True)

        # Initialize ActionMapper for dynamic event binding
        self.action_mapper = ActionMapper(self)

        # Global keyboard shortcuts
        self.root.bind("<Control-c>", lambda e: self.copy_to_clipboard())

        # Re-render image on window resize
        self.root.bind("<Configure>", self._on_window_resize)
        self._resize_after_id = None

        # --- Load Settings on Startup ---
        self.load_settings()

    # --- Settings Persistence ---
    def load_settings(self):
        """Loads paths from JSON file if it exists and checks if folders are valid."""
        # Load config through ConfigManager (handles validation and migration)
        config = self.config_manager.config

        # Apply loaded configuration
        self.apply_config(config)

    def save_settings(self):
        """Saves current paths and mode to JSON file."""
        self.config_manager.set("src", self.src_dir)
        self.config_manager.set("keep", self.keep_dir)
        self.config_manager.set("app_mode", self.app_mode)
        self.config_manager.save(self.config_manager.config)

    def apply_config(self, config):
        """Apply configuration changes to the application at runtime."""
        # Update internal config reference
        self.config_manager.config = config

        # Apply directory paths if they exist
        src = config.get("src", "")
        keep = config.get("keep", "")

        if src and os.path.isdir(src):
            self.src_dir = src
            self.lbl_src.config(text=src)

        if keep and os.path.isdir(keep):
            self.keep_dir = keep
            self.lbl_keep.config(text=keep)

        # Apply mode if saved in config
        saved_mode = config.get("app_mode", "sort")
        if saved_mode in ("sort", "view") and saved_mode != self.app_mode:
            self.app_mode = saved_mode
            self._apply_mode_ui()

        # Apply button and wheel mappings through ActionMapper
        self.action_mapper.bind_all(config)

        # Update instruction label to reflect current mappings
        self._update_instructions_label(config)

        # Update ready state
        self.check_ready()

        # If a session is active, re-render current image to pick up new bindings
        if self.image_files and self.current_pil_image is not None:
            self.show_current_image()

    def set_mode(self, mode):
        """Switch between 'sort' and 'view' modes. Preserves current session and image."""
        if mode == self.app_mode:
            return
        self.app_mode = mode
        self._apply_mode_ui()
        self.save_settings()

        # Setup reject folder if switching to sort mode with an active session
        if mode == "sort" and self.src_dir:
            self.reject_dir = os.path.join(self.src_dir, "_REJECTS")
            if not os.path.exists(self.reject_dir):
                os.makedirs(self.reject_dir)

        # Rebind events and update instruction bar for the new mode
        self.action_mapper.bind_all(self.config_manager.config)
        self._update_instructions_label(self.config_manager.config)
        self.check_ready()

    def _is_ready(self):
        """Check if the app has everything needed to start."""
        if self.app_mode == "view":
            return bool(self.src_dir)
        return bool(self.src_dir and self.keep_dir)

    def _apply_mode_ui(self):
        """Update UI elements to reflect the current mode."""
        if self.app_mode == "sort":
            # Sort mode: show keep destination row, update button text
            self.btn_keep.grid()
            self.lbl_keep.grid()
            self.btn_load.config(text="3. START CULLING")
            # Update mode toggle button appearances
            self.btn_mode_sort.config(bg="#007bff", fg="white", font=("Arial", 9, "bold"))
            self.btn_mode_view.config(bg="#d9d9d9", fg="#333", font=("Arial", 9))
        else:
            # View mode: hide keep destination row, update button text
            self.btn_keep.grid_remove()
            self.lbl_keep.grid_remove()
            self.btn_load.config(text="2. BROWSE IMAGES")
            # Update mode toggle button appearances
            self.btn_mode_sort.config(bg="#d9d9d9", fg="#333", font=("Arial", 9))
            self.btn_mode_view.config(bg="#17a2b8", fg="white", font=("Arial", 9, "bold"))

    def _update_instructions_label(self, config):
        """Update instruction label to show current mode's button/wheel/key mappings."""
        # Use mode-specific settings block; fall back to flat config for old formats
        settings = config.get(f"{self.app_mode}_settings", config)
        left = settings.get("button_mappings", {}).get("left_click", "keep").upper()
        right = settings.get("button_mappings", {}).get("right_click", "reject").upper()
        middle = settings.get("button_mappings", {}).get("middle_click", "disabled").upper()
        wheel_up = settings.get("wheel_mappings", {}).get("wheel_up", "previous").upper()
        wheel_down = settings.get("wheel_mappings", {}).get("wheel_down", "next").upper()

        key_mappings = settings.get("key_mappings", {})
        key_parts = []
        for key_name, action_name in key_mappings.items():
            if action_name != "disabled":
                display_key = self._format_key_name(key_name)
                display_action = action_name.upper().replace("_", " ")
                key_parts.append(f"{display_key}: {display_action}")

        # Build instruction text
        instructions = f"L-Click: {left}  |  R-Click: {right}"
        if middle != "DISABLED":
            instructions += f"  |  M-Click: {middle}"
        instructions += f"  |  Wheel: {wheel_up}/{wheel_down}"
        if key_parts:
            instructions += "  |  " + "  |  ".join(key_parts)
        self.lbl_instructions.config(text=instructions)

    @staticmethod
    def _format_key_name(key):
        """Format a key name for display."""
        key_display = {
            "space": "Space",
            "Up": "\u2191",
            "Down": "\u2193",
            "Left": "\u2190",
            "Right": "\u2192",
        }
        return key_display.get(key, key.upper() if len(key) == 1 else key)

    # --- Folder Selection Functions ---
    def select_src(self):
        path = filedialog.askdirectory(title="Select Source Folder containing images", initialdir=self.src_dir)
        if path:
            self.src_dir = path
            self.lbl_src.config(text=path)
            self.save_settings() # Save immediately
            self.check_ready()

    def select_keep(self):
        path = filedialog.askdirectory(title="Select Destination Folder for GOOD images", initialdir=self.keep_dir)
        if path:
            self.keep_dir = path
            self.lbl_keep.config(text=path)
            self.save_settings() # Save immediately
            self.check_ready()

    def check_ready(self):
        if self._is_ready():
            self.btn_load.config(state="normal")

    def auto_load_from_file(self, file_path):
        """Auto-load images from a specific file path (used when launched via 'Open With').

        Args:
            file_path: Full path to the image file that was clicked
        """
        # Validate the file exists and is an image
        if not os.path.isfile(file_path):
            messagebox.showerror("Error", f"File not found: {file_path}")
            return

        # Extract directory and filename
        src_directory = os.path.dirname(file_path)
        clicked_filename = os.path.basename(file_path)

        # Set source directory
        self.src_dir = src_directory
        self.lbl_src.config(text=src_directory)

        # Set keep directory to parent directory (only needed in sort mode)
        if self.app_mode == "sort":
            parent_dir = os.path.dirname(src_directory)
            if parent_dir and os.path.isdir(parent_dir):
                self.keep_dir = parent_dir
                self.lbl_keep.config(text=parent_dir)

        # Save settings
        self.save_settings()

        # Check if ready (should be true now)
        self.check_ready()

        # Auto-start
        if self._is_ready():
            self.load_images_start()

            # Find and display the specific file that was clicked
            for idx, img_info in enumerate(self.image_files):
                if os.path.basename(img_info["full_path"]) == clicked_filename:
                    self.current_index = idx
                    self.show_current_image()
                    break

    def open_settings(self):
        """Open settings dialog. Changes apply immediately to the current session."""
        dialog = SettingsDialog(self.root, self.config_manager, app_mode=self.app_mode)
        dialog.show()

    # --- Core Logic ---
    def load_images_start(self):
        if self.app_mode == "sort":
            # Setup Reject Folder
            self.reject_dir = os.path.join(self.src_dir, "_REJECTS")
            if not os.path.exists(self.reject_dir):
                os.makedirs(self.reject_dir)

        # Scan for images using RecursiveScanner
        try:
            recursive = self.config_manager.get("options.recursive_loading", False)
            self.image_files = RecursiveScanner.scan(self.src_dir, recursive)
        except FileNotFoundError:
            messagebox.showerror("Error", "Source folder not found. Did you move it?")
            return

        # Sort by full_path to maintain consistent order
        self.image_files.sort(key=lambda x: x["full_path"])

        if not self.image_files:
            messagebox.showwarning("No Images", "No image files found in source folder.")
            return

        self.current_index = 0
        self.show_current_image()

        # Disable load button while session is active
        if self.app_mode == "sort":
            self.btn_load.config(state="disabled", text="Culling in progress...")
        else:
            self.btn_load.config(state="disabled", text="Browsing images...")

        # Set focus to root so keyboard bindings (spacebar, zoom, etc.) work immediately
        self.root.focus_set()

    def show_current_image(self):
        if self.current_index < len(self.image_files):
            # Get image info dict
            image_info = self.image_files[self.current_index]
            filename = image_info["filename"]
            relative_path = image_info["relative_path"]
            full_path = image_info["full_path"]

            # Update Status - show relative path if it exists
            if relative_path:
                display_path = os.path.join(relative_path, filename)
            else:
                display_path = filename

            self.lbl_status.config(text=f"Image {self.current_index + 1} of {len(self.image_files)}: {display_path}")
            self.root.title(f"Image {self.current_index + 1} of {len(self.image_files)} — Rapid Image Culler")

            try:
                # Load full-size PIL image and cache it
                self.current_pil_image = Image.open(full_path)
                # Force load so file handle is released
                self.current_pil_image.load()

                # Ensure image is in a displayable mode (handles PSD CMYK, etc.)
                if self.current_pil_image.mode == 'CMYK':
                    self.current_pil_image = self.current_pil_image.convert('RGB')
                elif self.current_pil_image.mode not in ('RGB', 'RGBA', 'L', 'P'):
                    self.current_pil_image = self.current_pil_image.convert('RGB')

                # Reset zoom and pan for new image
                self.zoom_level = 1.0
                self.pan_offset = [0, 0]

                self._render_image()

            except Exception as e:
                print(f"Error loading image {display_path}: {e}")
                self.current_pil_image = None
                if self.app_mode == "sort":
                    self.action_reject(None)  # Auto-reject corrupted images in sort mode
                else:
                    self.action_next(None)  # Skip unreadable images in view mode
        else:
            self.finish_culling()

    def _render_image(self):
        """Render current image with zoom and pan applied."""
        if self.current_pil_image is None:
            return

        win_w = self.image_frame.winfo_width()
        win_h = self.image_frame.winfo_height()

        if win_w <= 10 or win_h <= 10:
            return

        img = self.current_pil_image
        img_w, img_h = img.size

        if self.zoom_level == 1.0:
            # Fit to page: thumbnail behavior
            display = img.copy()
            display.thumbnail((win_w, win_h), Image.Resampling.LANCZOS)
        else:
            # Calculate the fit-to-page scale first
            fit_scale = min(win_w / img_w, win_h / img_h)
            # Actual scale is fit_scale * zoom_level
            actual_scale = fit_scale * self.zoom_level
            scaled_w = int(img_w * actual_scale)
            scaled_h = int(img_h * actual_scale)

            # Resize the full image
            scaled = img.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)

            # Clamp pan offset so we don't pan beyond image edges
            max_pan_x = max(0, (scaled_w - win_w) / 2)
            max_pan_y = max(0, (scaled_h - win_h) / 2)
            self.pan_offset[0] = max(-max_pan_x, min(max_pan_x, self.pan_offset[0]))
            self.pan_offset[1] = max(-max_pan_y, min(max_pan_y, self.pan_offset[1]))

            # Calculate crop region (center + pan offset)
            cx = scaled_w / 2 + self.pan_offset[0]
            cy = scaled_h / 2 + self.pan_offset[1]

            left = max(0, int(cx - win_w / 2))
            top = max(0, int(cy - win_h / 2))
            right = min(scaled_w, left + win_w)
            bottom = min(scaled_h, top + win_h)

            display = scaled.crop((left, top, right, bottom))

        self.photo_image = ImageTk.PhotoImage(display)
        self.image_label.config(image=self.photo_image, text="")

        # Update zoom level display
        if self.zoom_level == 1.0:
            zoom_text = "Fit"
        elif self.zoom_level == int(self.zoom_level):
            zoom_text = f"{int(self.zoom_level)}x"
        else:
            zoom_text = f"{self.zoom_level:.2f}x"
        self.lbl_zoom_level.config(text=zoom_text)

    def move_and_advance(self, destination):
        if self.current_index < len(self.image_files):
            # Get image info dict
            image_info = self.image_files[self.current_index]
            filename = image_info["filename"]
            relative_path = image_info["relative_path"]
            src_path = image_info["full_path"]

            try:
                # Create subdirectory in destination if needed (preserving structure)
                if relative_path:
                    dest_subdir = os.path.join(destination, relative_path)
                    os.makedirs(dest_subdir, exist_ok=True)
                    final_dest = dest_subdir
                else:
                    final_dest = destination

                # Construct destination path
                dst_path = os.path.join(final_dest, filename)

                # Ensure destination filename is unique just in case
                base, ext = os.path.splitext(filename)
                counter = 1
                while os.path.exists(dst_path):
                     dst_path = os.path.join(final_dest, f"{base}_{counter}{ext}")
                     counter += 1

                shutil.move(src_path, dst_path)

                # Log with relative path if present
                display_path = os.path.join(relative_path, filename) if relative_path else filename
                print(f"Moved {display_path} to {destination}")

            except (OSError, PermissionError) as e:
                messagebox.showerror("File Error", f"Could not move file:\n{e}")
                return # Don't advance index if move failed

            # Remove the moved image from the list to keep index accurate
            self.image_files.pop(self.current_index)

            # Don't increment index - the next image is now at the current index
            # If we're past the end of the list, decrement to show the last image
            if self.current_index >= len(self.image_files) and len(self.image_files) > 0:
                self.current_index = len(self.image_files) - 1

            # Add a tiny delay to allow UI to refresh before showing next
            self.root.after(10, self.show_current_image)

    def action_keep(self, event):
        if self.app_mode == "view":
            return  # No file operations in view mode
        if self.image_files:
            self.move_and_advance(self.keep_dir)

    def action_reject(self, event):
        if self.app_mode == "view":
            return  # No file operations in view mode
        if not self.reject_dir:
            # Safety: set up reject dir if it wasn't initialized
            if self.src_dir:
                self.reject_dir = os.path.join(self.src_dir, "_REJECTS")
                os.makedirs(self.reject_dir, exist_ok=True)
            else:
                return
        if self.image_files:
            self.move_and_advance(self.reject_dir)

    def action_next(self, event):
        """Navigate to next image without moving current."""
        if not self.image_files:
            return
        if self.current_index < len(self.image_files) - 1:
            self.current_index += 1
            self.show_current_image()
        elif self.app_mode == "view":
            # Wrap around in view mode
            self.current_index = 0
            self.show_current_image()

    def action_previous(self, event):
        """Navigate to previous image."""
        if not self.image_files:
            return
        if self.current_index > 0:
            self.current_index -= 1
            self.show_current_image()
        elif self.app_mode == "view":
            # Wrap around in view mode
            self.current_index = len(self.image_files) - 1
            self.show_current_image()

    def action_skip(self, event):
        """Mark as skipped and advance (future: track skipped items)."""
        # For now, just advance without moving file
        self.action_next(event)

    def action_random(self, event):
        """Jump to a random image."""
        if self.image_files and len(self.image_files) > 1:
            new_index = self.current_index
            # Ensure we pick a different image
            while new_index == self.current_index:
                new_index = random.randint(0, len(self.image_files) - 1)
            self.current_index = new_index
            self.show_current_image()
        elif self.image_files:
            self.show_current_image()

    def zoom_in(self, event):
        """Zoom into the current image."""
        if self.current_pil_image is None:
            return
        self.zoom_level = min(self.max_zoom, self.zoom_level + self.zoom_step)
        self._render_image()

    def zoom_out(self, event):
        """Zoom out of the current image."""
        if self.current_pil_image is None:
            return
        new_zoom = self.zoom_level - self.zoom_step
        if new_zoom < 1.0:
            new_zoom = 1.0
            self.pan_offset = [0, 0]
        self.zoom_level = new_zoom
        self._render_image()

    def fit_to_page(self, event):
        """Reset zoom to fit image in window."""
        if self.current_pil_image is None:
            return
        self.zoom_level = 1.0
        self.pan_offset = [0, 0]
        self._render_image()

    def copy_to_clipboard(self):
        """Copy the current image to the system clipboard."""
        if self.current_pil_image is None:
            return
        try:
            import win32clipboard
            output = io.BytesIO()
            # Convert to BMP for Windows clipboard (strip BMP file header - first 14 bytes)
            img = self.current_pil_image.convert('RGB')
            img.save(output, 'BMP')
            data = output.getvalue()[14:]
            output.close()
            win32clipboard.OpenClipboard()
            win32clipboard.EmptyClipboard()
            win32clipboard.SetClipboardData(win32clipboard.CF_DIB, data)
            win32clipboard.CloseClipboard()
            self.lbl_status.config(text="Image copied to clipboard!")
        except ImportError:
            messagebox.showerror("Error", "pywin32 is required for clipboard support.\nInstall with: pip install pywin32")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to copy image: {e}")

    def start_crop_copy(self):
        """Enter crop selection mode — overlay a Canvas on the image for drawing."""
        if self.current_pil_image is None:
            return
        if self.crop_mode:
            return  # Already in crop mode, ignore double-click
        self.crop_mode = True
        self.crop_start = None
        self.btn_crop_copy.config(bg="#ffcc00", text="Select area...")
        self.lbl_status.config(text="Draw a rectangle on the image, then release to copy. Press Escape to cancel.")

        # Create a Canvas overlay that sits exactly on top of the image label
        label = self.image_label
        self.crop_canvas = tk.Canvas(self.image_frame, highlightthickness=0,
                                     bg="#333333", cursor="crosshair")
        self.crop_canvas.place(x=label.winfo_x(), y=label.winfo_y(),
                               width=label.winfo_width(), height=label.winfo_height())

        # Draw current image onto the canvas
        if self.photo_image:
            cw = label.winfo_width()
            ch = label.winfo_height()
            self.crop_canvas.create_image(cw // 2, ch // 2, image=self.photo_image, tags="bg")

        # Dim overlay — semi-transparent dark layer drawn over the whole image
        # (we'll punch a hole in it during drag via the _crop_redraw_overlay method)
        self._crop_dim_image = None  # will hold dimmed PhotoImage reference

        # Bind crop events on the canvas
        self.crop_canvas.bind("<ButtonPress-1>", self._crop_start)
        self.crop_canvas.bind("<B1-Motion>", self._crop_drag)
        self.crop_canvas.bind("<ButtonRelease-1>", self._crop_end)
        self.root.bind("<Escape>", self._crop_cancel)


    def _crop_cancel(self, event=None):
        """Cancel crop mode, destroy overlay, restore normal bindings."""
        if not self.crop_mode:
            return  # Not in crop mode, nothing to cancel
        self.crop_mode = False
        self.crop_start = None
        self._crop_dim_image = None
        if hasattr(self, 'crop_canvas') and self.crop_canvas:
            self.crop_canvas.destroy()
            self.crop_canvas = None
        self.btn_crop_copy.config(bg="#d0d0d0", text="Crop+Copy")
        # Unbind Escape first, then flush pending events before restoring normal
        # bindings — prevents queued mouse-release events (from clicking the canvas)
        # from firing keep/reject via the newly-restored image_label handlers.
        self.root.unbind("<Escape>")
        self.root.update_idletasks()
        self.action_mapper.bind_all(self.config_manager.config)
        if self.image_files:
            self.show_current_image()

    def _crop_start(self, event):
        """Record where the user started drawing."""
        self.crop_start = (event.x, event.y)
        # Clear any previous selection visuals
        self.crop_canvas.delete("selection")
        self.crop_canvas.delete("dim")
        self.crop_canvas.delete("size_label")

    def _crop_drag(self, event):
        """Draw selection rectangle with dimmed surround as user drags."""
        if not self.crop_start:
            return
        x0, y0 = self.crop_start
        x1, y1 = event.x, event.y
        canvas = self.crop_canvas
        cw = canvas.winfo_width()
        ch = canvas.winfo_height()

        # Clear previous frame
        canvas.delete("dim")
        canvas.delete("selection")
        canvas.delete("size_label")

        # Normalize
        left, right = min(x0, x1), max(x0, x1)
        top, bottom = min(y0, y1), max(y0, y1)

        # Draw four semi-transparent dim rectangles around the selection
        # Using stipple pattern for the dim effect
        dim_opts = {"fill": "black", "stipple": "gray50", "outline": ""}
        canvas.create_rectangle(0, 0, cw, top, tags="dim", **dim_opts)         # top strip
        canvas.create_rectangle(0, bottom, cw, ch, tags="dim", **dim_opts)      # bottom strip
        canvas.create_rectangle(0, top, left, bottom, tags="dim", **dim_opts)   # left strip
        canvas.create_rectangle(right, top, cw, bottom, tags="dim", **dim_opts) # right strip

        # Draw selection border
        canvas.create_rectangle(left, top, right, bottom,
                                outline="#00ff00", width=2, tags="selection")

        # Show dimensions label near the selection
        sel_w = abs(x1 - x0)
        sel_h = abs(y1 - y0)
        # Convert to original image pixel dimensions for the label
        img_dims = self._screen_to_image_coords(left, top, right, bottom)
        if img_dims:
            iw = img_dims[2] - img_dims[0]
            ih = img_dims[3] - img_dims[1]
            label_text = f"{iw} x {ih} px"
        else:
            label_text = f"{sel_w} x {sel_h}"
        label_y = bottom + 16 if bottom + 20 < ch else top - 16
        canvas.create_text((left + right) / 2, label_y, text=label_text,
                           fill="#00ff00", font=("Arial", 10, "bold"), tags="size_label")

    def _screen_to_image_coords(self, sx0, sy0, sx1, sy1):
        """Convert screen coordinates on the canvas to original image pixel coordinates.
        Returns (img_left, img_top, img_right, img_bottom) or None."""
        label = self.image_label
        label_w = label.winfo_width()
        label_h = label.winfo_height()
        img = self.current_pil_image
        if img is None:
            return None
        img_w, img_h = img.size

        if self.zoom_level == 1.0:
            display = img.copy()
            display.thumbnail((label_w, label_h), Image.Resampling.LANCZOS)
            disp_w, disp_h = display.size
            offset_x = (label_w - disp_w) / 2
            offset_y = (label_h - disp_h) / 2
            scale = img_w / disp_w
            img_left = int(max(0, (sx0 - offset_x) * scale))
            img_top = int(max(0, (sy0 - offset_y) * scale))
            img_right = int(min(img_w, (sx1 - offset_x) * scale))
            img_bottom = int(min(img_h, (sy1 - offset_y) * scale))
        else:
            fit_scale = min(label_w / img_w, label_h / img_h)
            actual_scale = fit_scale * self.zoom_level
            scaled_w = int(img_w * actual_scale)
            scaled_h = int(img_h * actual_scale)
            cx = scaled_w / 2 + self.pan_offset[0]
            cy = scaled_h / 2 + self.pan_offset[1]
            vis_left = max(0, int(cx - label_w / 2))
            vis_top = max(0, int(cy - label_h / 2))
            img_left = int(max(0, (vis_left + sx0) / actual_scale))
            img_top = int(max(0, (vis_top + sy0) / actual_scale))
            img_right = int(min(img_w, (vis_left + sx1) / actual_scale))
            img_bottom = int(min(img_h, (vis_top + sy1) / actual_scale))

        return (img_left, img_top, img_right, img_bottom)

    def _crop_end(self, event):
        """Finish crop selection and copy the region to clipboard."""
        if not self.crop_start:
            return
        x0, y0 = self.crop_start
        x1, y1 = event.x, event.y

        # Ensure we have a valid rectangle (not just a click)
        if abs(x1 - x0) < 5 or abs(y1 - y0) < 5:
            self._crop_cancel()
            return

        # Normalize and convert to image coordinates
        left, right = min(x0, x1), max(x0, x1)
        top, bottom = min(y0, y1), max(y0, y1)
        coords = self._screen_to_image_coords(left, top, right, bottom)

        if coords:
            img_left, img_top, img_right, img_bottom = coords
            if img_right > img_left and img_bottom > img_top:
                cropped = self.current_pil_image.crop((img_left, img_top, img_right, img_bottom))
                try:
                    import win32clipboard
                    output = io.BytesIO()
                    cropped.convert('RGB').save(output, 'BMP')
                    data = output.getvalue()[14:]
                    output.close()
                    win32clipboard.OpenClipboard()
                    win32clipboard.EmptyClipboard()
                    win32clipboard.SetClipboardData(win32clipboard.CF_DIB, data)
                    win32clipboard.CloseClipboard()
                    self.lbl_status.config(
                        text=f"Cropped region ({img_right-img_left}x{img_bottom-img_top}) copied to clipboard!")
                except ImportError:
                    messagebox.showerror("Error",
                        "pywin32 is required for clipboard support.\nInstall with: pip install pywin32")
                except Exception as e:
                    messagebox.showerror("Error", f"Failed to copy cropped image: {e}")

        self._crop_cancel()

    def _on_window_resize(self, event):
        """Debounced handler to re-render image when window is resized."""
        if event.widget != self.root:
            return
        if self._resize_after_id:
            self.root.after_cancel(self._resize_after_id)
        self._resize_after_id = self.root.after(100, self._render_image)

    def _on_pan_start(self, event):
        """Handle mouse press for panning."""
        if self.zoom_level > 1.0:
            self.panning = True
            self.pan_start = (event.x, event.y)
            self.drag_distance = 0

    def _on_pan_motion(self, event):
        """Handle mouse drag for panning."""
        if self.panning and self.pan_start:
            dx = event.x - self.pan_start[0]
            dy = event.y - self.pan_start[1]
            self.drag_distance += abs(dx) + abs(dy)
            self.pan_offset[0] -= dx
            self.pan_offset[1] -= dy
            self.pan_start = (event.x, event.y)
            self._render_image()

    def _on_pan_end(self, event):
        """Handle mouse release after panning."""
        was_panning = self.panning and self.drag_distance > 5
        self.panning = False
        self.pan_start = None
        # If it was a click (not a drag) and we're zoomed, don't consume the event
        # The left-click action is handled separately via _on_left_click
        return was_panning

    def _on_left_click(self, event):
        """Handle left click - either pan start or action."""
        if self.zoom_level > 1.0:
            # Start pan tracking
            self._on_pan_start(event)
        else:
            # Not zoomed - execute the configured left-click action
            self._do_left_click_action(event)

    def _on_left_release(self, event):
        """Handle left button release."""
        was_drag = self._on_pan_end(event)
        if self.zoom_level > 1.0 and not was_drag:
            # Was a click while zoomed (not a drag) - execute action
            self._do_left_click_action(event)

    def _do_left_click_action(self, event):
        """Execute the configured left-click action."""
        config = self.config_manager.config
        settings = config.get(f"{self.app_mode}_settings", config)
        left_action = settings.get("button_mappings", {}).get("left_click", "keep")
        if left_action != "disabled":
            handler = self.action_mapper._create_handler(left_action)
            if handler:
                handler(event)

    def finish_culling(self):
        self.image_label.config(image="", text="--- NO MORE IMAGES ---", fg="white", font=("Arial", 24))
        self.lbl_status.config(text="Finished.")
        self.root.title("Rapid Image Culler for Datasets")
        if self.app_mode == "sort":
            messagebox.showinfo("Done", "All images have been sorted!")
            self.root.quit()
        else:
            messagebox.showinfo("Done", "Reached the end of the image list.")
            # Re-enable load button so the user can reload
            self.btn_load.config(state="normal", text="2. BROWSE IMAGES")
            self.image_files = []

if __name__ == "__main__":
    root = tk.Tk()
    app = RapidCullerApp(root)
    # Need to update idletasks to get accurate initial frame dimensions for resizing
    root.update_idletasks()

    # Check if a file path was passed as command-line argument (from "Open With")
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        # Schedule auto-load after the main window is fully initialized
        root.after(100, lambda: app.auto_load_from_file(file_path))

    root.mainloop()