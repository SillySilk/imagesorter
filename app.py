import sys
import os
import shutil
import json
import tkinter as tk
from tkinter import filedialog, messagebox
from PIL import Image, ImageTk
import copy

class ConfigManager:
    """Manages application configuration with validation, migration, and persistence."""

    DEFAULT_CONFIG = {
        "src": "",
        "keep": "",
        "button_mappings": {
            "left_click": "keep",
            "right_click": "reject"
        },
        "wheel_mappings": {
            "wheel_up": "previous",
            "wheel_down": "next"
        },
        "options": {
            "recursive_loading": False
        }
    }

    VALID_ACTIONS = {"keep", "reject", "next", "previous", "skip", "disabled"}

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
        # Check required top-level keys
        if not isinstance(config, dict):
            return False, "Config must be a dictionary"

        # v1 config (old format) is valid for migration
        if "src" in config and "keep" in config and "button_mappings" not in config:
            return True, ""

        # v2 config validation
        required_keys = ["src", "keep", "button_mappings", "wheel_mappings", "options"]
        for key in required_keys:
            if key not in config:
                return False, f"Missing required key: {key}"

        # Validate button mappings
        if not isinstance(config["button_mappings"], dict):
            return False, "button_mappings must be a dictionary"

        button_keys = ["left_click", "right_click"]
        for key in button_keys:
            if key not in config["button_mappings"]:
                return False, f"Missing button mapping: {key}"
            action = config["button_mappings"][key]
            if action not in self.VALID_ACTIONS:
                return False, f"Invalid action '{action}' for {key}"

        # Validate wheel mappings
        if not isinstance(config["wheel_mappings"], dict):
            return False, "wheel_mappings must be a dictionary"

        wheel_keys = ["wheel_up", "wheel_down"]
        for key in wheel_keys:
            if key not in config["wheel_mappings"]:
                return False, f"Missing wheel mapping: {key}"
            action = config["wheel_mappings"][key]
            if action not in self.VALID_ACTIONS:
                return False, f"Invalid action '{action}' for {key}"

        # Validate options
        if not isinstance(config["options"], dict):
            return False, "options must be a dictionary"

        if "recursive_loading" not in config["options"]:
            return False, "Missing option: recursive_loading"

        if not isinstance(config["options"]["recursive_loading"], bool):
            return False, "recursive_loading must be a boolean"

        return True, ""

    def migrate(self, old_config):
        """Migrate old config format to new schema."""
        # Check if already v2 format
        if "button_mappings" in old_config:
            return old_config

        # v1 to v2 migration
        print("Migrating config from v1 to v2 format...")
        new_config = copy.deepcopy(self.DEFAULT_CONFIG)
        new_config["src"] = old_config.get("src", "")
        new_config["keep"] = old_config.get("keep", "")

        # Save migrated config
        self.save(new_config)

        return new_config

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
        "disabled": None
    }

    def __init__(self, app_instance):
        """Initialize ActionMapper with reference to RapidCullerApp instance."""
        self.app = app_instance
        self.current_bindings = {}

    def bind_all(self, config):
        """Bind all events based on config."""
        # Remove existing bindings first
        self.unbind_all()

        # Bind button events
        button_mappings = config.get("button_mappings", {})
        self._bind_buttons(button_mappings)

        # Bind wheel events
        wheel_mappings = config.get("wheel_mappings", {})
        self._bind_wheel(wheel_mappings)

    def unbind_all(self):
        """Remove all current bindings."""
        image_label = self.app.image_label

        # Unbind all previously bound events
        for event_type in self.current_bindings:
            try:
                image_label.unbind(event_type)
            except:
                pass  # Ignore errors if binding doesn't exist

        self.current_bindings.clear()

    def _bind_buttons(self, button_config):
        """Bind mouse button events."""
        image_label = self.app.image_label

        # Left click (Button-1)
        left_action = button_config.get("left_click", "keep")
        if left_action != "disabled":
            handler = self._create_handler(left_action)
            if handler:
                image_label.bind("<Button-1>", handler)
                self.current_bindings["<Button-1>"] = left_action

        # Right click (Button-3)
        right_action = button_config.get("right_click", "reject")
        if right_action != "disabled":
            handler = self._create_handler(right_action)
            if handler:
                image_label.bind("<Button-3>", handler)
                self.current_bindings["<Button-3>"] = right_action

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
            # On Windows/MacOS, event.delta indicates scroll direction
            # Positive delta = scroll up, Negative delta = scroll down
            if event.delta > 0 and up_handler:
                up_handler(event)
            elif event.delta < 0 and down_handler:
                down_handler(event)
        return wheel_handler

class RecursiveScanner:
    """Scans directory tree for images, maintaining structure information."""

    VALID_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.bmp', '.webp')

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
    """Modal dialog for configuring application settings."""

    def __init__(self, parent, config_manager):
        """Initialize SettingsDialog with parent window and config manager."""
        self.parent = parent
        self.config_manager = config_manager
        self.dialog = None
        self.temp_config = {}
        self.widgets = {}

    def _build_button_mappings_section(self, parent_frame):
        """Build button mapping controls."""
        # Create LabelFrame for button mappings
        frame = tk.LabelFrame(parent_frame, text="Button Mappings", padx=10, pady=10)
        frame.pack(fill="x", padx=10, pady=5)

        # Action options for dropdowns
        action_options = ["Keep", "Reject", "Next", "Previous", "Skip", "Disabled"]

        # Left Click mapping
        tk.Label(frame, text="Left Click:", anchor="w").grid(row=0, column=0, sticky="w", padx=5, pady=5)

        left_var = tk.StringVar(self.dialog)
        current_left = self.temp_config.get("button_mappings", {}).get("left_click", "keep")
        left_var.set(current_left.capitalize())

        left_menu = tk.OptionMenu(frame, left_var, *action_options)
        left_menu.config(width=12)
        left_menu.grid(row=0, column=1, sticky="w", padx=5, pady=5)

        self.widgets["left_click"] = left_var

        # Right Click mapping
        tk.Label(frame, text="Right Click:", anchor="w").grid(row=1, column=0, sticky="w", padx=5, pady=5)

        right_var = tk.StringVar(self.dialog)
        current_right = self.temp_config.get("button_mappings", {}).get("right_click", "reject")
        right_var.set(current_right.capitalize())

        right_menu = tk.OptionMenu(frame, right_var, *action_options)
        right_menu.config(width=12)
        right_menu.grid(row=1, column=1, sticky="w", padx=5, pady=5)

        self.widgets["right_click"] = right_var

    def _build_wheel_mappings_section(self, parent_frame):
        """Build wheel mapping controls."""
        # Create LabelFrame for wheel mappings
        frame = tk.LabelFrame(parent_frame, text="Mouse Wheel Mappings", padx=10, pady=10)
        frame.pack(fill="x", padx=10, pady=5)

        # Action options for dropdowns
        action_options = ["Keep", "Reject", "Next", "Previous", "Skip", "Disabled"]

        # Wheel Up mapping
        tk.Label(frame, text="Wheel Up:", anchor="w").grid(row=0, column=0, sticky="w", padx=5, pady=5)

        wheel_up_var = tk.StringVar(self.dialog)
        current_wheel_up = self.temp_config.get("wheel_mappings", {}).get("wheel_up", "previous")
        wheel_up_var.set(current_wheel_up.capitalize())

        wheel_up_menu = tk.OptionMenu(frame, wheel_up_var, *action_options)
        wheel_up_menu.config(width=12)
        wheel_up_menu.grid(row=0, column=1, sticky="w", padx=5, pady=5)

        self.widgets["wheel_up"] = wheel_up_var

        # Wheel Down mapping
        tk.Label(frame, text="Wheel Down:", anchor="w").grid(row=1, column=0, sticky="w", padx=5, pady=5)

        wheel_down_var = tk.StringVar(self.dialog)
        current_wheel_down = self.temp_config.get("wheel_mappings", {}).get("wheel_down", "next")
        wheel_down_var.set(current_wheel_down.capitalize())

        wheel_down_menu = tk.OptionMenu(frame, wheel_down_var, *action_options)
        wheel_down_menu.config(width=12)
        wheel_down_menu.grid(row=1, column=1, sticky="w", padx=5, pady=5)

        self.widgets["wheel_down"] = wheel_down_var

    def _build_options_section(self, parent_frame):
        """Build options controls."""
        # Create LabelFrame for options
        frame = tk.LabelFrame(parent_frame, text="Loading Options", padx=10, pady=10)
        frame.pack(fill="x", padx=10, pady=5)

        # Recursive loading checkbox
        recursive_var = tk.BooleanVar(self.dialog)
        current_recursive = self.temp_config.get("options", {}).get("recursive_loading", False)
        recursive_var.set(current_recursive)

        recursive_check = tk.Checkbutton(
            frame,
            text="Load images from subdirectories recursively",
            variable=recursive_var
        )
        recursive_check.pack(anchor="w", padx=5, pady=5)

        self.widgets["recursive_loading"] = recursive_var

    def _build_button_bar(self, parent_frame):
        """Build dialog button bar."""
        # Create Frame for buttons at bottom
        frame = tk.Frame(parent_frame, padx=10, pady=10)
        frame.pack(fill="x", side="bottom")

        # Reset Defaults button (left side)
        reset_btn = tk.Button(
            frame,
            text="Reset Defaults",
            bg="#6c757d",
            fg="white",
            command=self._reset_to_defaults
        )
        reset_btn.pack(side="left", padx=5)

        # Cancel button (right side)
        cancel_btn = tk.Button(
            frame,
            text="Cancel",
            bg="#6c757d",
            fg="white",
            command=self._cancel
        )
        cancel_btn.pack(side="right", padx=5)

        # Save button (right side)
        save_btn = tk.Button(
            frame,
            text="Save",
            bg="#28a745",
            fg="white",
            font=("Arial", 10, "bold"),
            command=self._validate_and_save
        )
        save_btn.pack(side="right", padx=5)

    def show(self):
        """Display modal settings dialog."""
        # Create modal Toplevel window
        self.dialog = tk.Toplevel(self.parent)
        self.dialog.title("Settings")
        self.dialog.geometry("500x400")
        self.dialog.transient(self.parent)  # Set parent window
        self.dialog.grab_set()  # Make modal

        # Initialize temp_config as deep copy of current config
        self.temp_config = copy.deepcopy(self.config_manager.config)

        # Build button bar first (packs at bottom)
        self._build_button_bar(self.dialog)

        # Build UI sections (pack from top)
        self._build_button_mappings_section(self.dialog)
        self._build_wheel_mappings_section(self.dialog)
        self._build_options_section(self.dialog)

        # Make dialog modal - wait for window to close
        self.dialog.wait_window()

    def _validate_and_save(self):
        """Validate temp_config and save if valid."""
        # Read values from all widgets and update temp_config
        self.temp_config["button_mappings"]["left_click"] = self.widgets["left_click"].get().lower()
        self.temp_config["button_mappings"]["right_click"] = self.widgets["right_click"].get().lower()
        self.temp_config["wheel_mappings"]["wheel_up"] = self.widgets["wheel_up"].get().lower()
        self.temp_config["wheel_mappings"]["wheel_down"] = self.widgets["wheel_down"].get().lower()
        self.temp_config["options"]["recursive_loading"] = self.widgets["recursive_loading"].get()

        # Validate configuration
        is_valid, error_msg = self.config_manager.validate(self.temp_config)
        if not is_valid:
            messagebox.showerror("Invalid Settings", error_msg)
            return

        # Check for warnings (non-blocking)
        warnings = self._check_warnings(self.temp_config)
        if warnings:
            proceed = messagebox.askyesno(
                "Configuration Warning",
                f"{warnings}\n\nProceed anyway?"
            )
            if not proceed:
                return

        # Save configuration
        if self.config_manager.save(self.temp_config):
            # Apply changes immediately
            self.parent.apply_config(self.temp_config)

            # Close dialog
            self.dialog.destroy()
        else:
            messagebox.showerror("Save Failed", "Could not save settings. Check console for errors.")

    def _check_warnings(self, config):
        """Return warning messages for potentially problematic configs."""
        warnings = []

        # Check if no buttons are mapped to keep/reject
        button_actions = list(config["button_mappings"].values())
        wheel_actions = list(config["wheel_mappings"].values())
        all_actions = button_actions + wheel_actions

        if "keep" not in all_actions and "reject" not in all_actions:
            warnings.append("⚠ No buttons or wheel actions mapped to Keep or Reject.\nYou won't be able to sort images!")

        return "\n".join(warnings) if warnings else None

    def _cancel(self):
        """Close dialog without saving."""
        self.dialog.destroy()

    def _reset_to_defaults(self):
        """Reset all settings to default values."""
        # Load defaults from ConfigManager
        defaults = copy.deepcopy(ConfigManager.DEFAULT_CONFIG)

        # Update temp_config
        self.temp_config = defaults

        # Update all widgets to show default values
        self.widgets["left_click"].set(defaults["button_mappings"]["left_click"].capitalize())
        self.widgets["right_click"].set(defaults["button_mappings"]["right_click"].capitalize())
        self.widgets["wheel_up"].set(defaults["wheel_mappings"]["wheel_up"].capitalize())
        self.widgets["wheel_down"].set(defaults["wheel_mappings"]["wheel_down"].capitalize())
        self.widgets["recursive_loading"].set(defaults["options"]["recursive_loading"])

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

        # --- GUI Layout ---
        
        # Top Control Panel
        control_frame = tk.Frame(root, padx=10, pady=10, bg="#e1e1e1")
        control_frame.pack(fill="x")

        # Source Button and Label
        btn_src = tk.Button(control_frame, text="1. Select SOURCE Folder", bg="#d9d9d9", command=self.select_src)
        btn_src.grid(row=0, column=0, sticky="w", padx=5, pady=5)
        self.lbl_src = tk.Label(control_frame, text="No folder selected", bg="#e1e1e1", anchor="w")
        self.lbl_src.grid(row=0, column=1, sticky="we", padx=5)

        # Keep Button and Label
        btn_keep = tk.Button(control_frame, text="2. Select KEEP Destination", bg="#d9d9d9", command=self.select_keep)
        btn_keep.grid(row=1, column=0, sticky="w", padx=5, pady=5)
        self.lbl_keep = tk.Label(control_frame, text="No folder selected", bg="#e1e1e1", anchor="w")
        self.lbl_keep.grid(row=1, column=1, sticky="we", padx=5)

        # Load Button
        self.btn_load = tk.Button(control_frame, text="3. START CULLING", bg="#28a745", fg="white", font=("Arial", 11, "bold"), state="disabled", command=self.load_images_start)
        self.btn_load.grid(row=2, column=0, columnspan=2, sticky="we", padx=5, pady=(10,5))

        # Settings Button
        btn_settings = tk.Button(control_frame, text="⚙ Settings", bg="#6c757d", fg="white", command=self.open_settings)
        btn_settings.grid(row=2, column=2, sticky="e", padx=5, pady=(10,5))

        control_frame.columnconfigure(1, weight=1)

        # Instructions Area
        instr_frame = tk.Frame(root, bg="#f0f0f0", padx=10, pady=5)
        instr_frame.pack(fill="x")
        tk.Label(instr_frame, text="INSTRUCTIONS:", font=("Arial", 9, "bold"), bg="#f0f0f0").pack(side="left")
        self.lbl_instructions = tk.Label(instr_frame, text="", bg="#f0f0f0", fg="#555")
        self.lbl_instructions.pack(side="left", padx=10)
        self.lbl_status = tk.Label(instr_frame, text="Waiting to start...", font=("Arial", 9), bg="#f0f0f0", fg="blue")
        self.lbl_status.pack(side="right")

        # Main Image Display Area
        self.image_frame = tk.Frame(root, bg="#333333")
        self.image_frame.pack(fill="both", expand=True)
        
        self.image_label = tk.Label(self.image_frame, text="Load folders to begin", bg="#333333", fg="#888888")
        self.image_label.pack(fill="both", expand=True)

        # Initialize ActionMapper for dynamic event binding
        self.action_mapper = ActionMapper(self)

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
        """Saves current paths to JSON file."""
        # Update config with current paths
        self.config_manager.set("src", self.src_dir)
        self.config_manager.set("keep", self.keep_dir)

        # Save through ConfigManager
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

        # Apply button and wheel mappings through ActionMapper
        self.action_mapper.bind_all(config)

        # Update instruction label to reflect current mappings
        self._update_instructions_label(config)

        # Update ready state
        self.check_ready()

    def _update_instructions_label(self, config):
        """Update instruction label to show current button/wheel mappings."""
        # Get current mappings
        left = config.get("button_mappings", {}).get("left_click", "keep").upper()
        right = config.get("button_mappings", {}).get("right_click", "reject").upper()
        wheel_up = config.get("wheel_mappings", {}).get("wheel_up", "previous").upper()
        wheel_down = config.get("wheel_mappings", {}).get("wheel_down", "next").upper()

        # Build instruction text
        instructions = f"L-Click: {left}  |  R-Click: {right}  |  Wheel: {wheel_up}/{wheel_down}"
        self.lbl_instructions.config(text=instructions)

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
        if self.src_dir and self.keep_dir:
            self.btn_load.config(state="normal")

    def open_settings(self):
        """Open settings dialog."""
        # Check if culling is in progress
        if self.image_files and self.btn_load.cget("state") == "disabled":
            # Culling is in progress - inform user changes apply next session
            result = messagebox.askyesno(
                "Culling In Progress",
                "Culling is currently in progress.\nSettings changes will apply to the next session.\n\nOpen settings anyway?"
            )
            if not result:
                return

        # Create and show settings dialog
        dialog = SettingsDialog(self.root, self.config_manager)
        dialog.show()

    # --- Core Logic ---
    def load_images_start(self):
        # 1. Setup Reject Folder
        self.reject_dir = os.path.join(self.src_dir, "_REJECTS")
        if not os.path.exists(self.reject_dir):
            os.makedirs(self.reject_dir)

        # 2. Scan for images using RecursiveScanner
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
        # Disable controls once started so paths don't change mid-stream
        self.btn_load.config(state="disabled", text="Culling in progress...")

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

            try:
                # Load and Resize Image to fit window
                pil_img = Image.open(full_path)

                # Get current window dimensions for resizing
                win_w = self.image_frame.winfo_width()
                win_h = self.image_frame.winfo_height()

                # Ensure dimensions are valid before resizing
                if win_w > 10 and win_h > 10:
                    # Use thumbnail to resize while maintaining aspect ratio
                    pil_img.thumbnail((win_w, win_h), Image.Resampling.LANCZOS)

                self.photo_image = ImageTk.PhotoImage(pil_img)
                self.image_label.config(image=self.photo_image, text="") # Remove placeholder text

            except Exception as e:
                print(f"Error loading image {display_path}: {e}")
                self.action_reject(None) # Auto-reject corrupted images
        else:
            self.finish_culling()

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

            # Advance index *only* if move was successful
            self.current_index += 1
            # Add a tiny delay to allow UI to refresh before showing next
            self.root.after(10, self.show_current_image)

    def action_keep(self, event):
        # Left click handler
        if self.image_files:
            self.move_and_advance(self.keep_dir)

    def action_reject(self, event):
        # Right click handler
        if self.image_files:
            self.move_and_advance(self.reject_dir)

    def action_next(self, event):
        """Navigate to next image without moving current."""
        if self.image_files and self.current_index < len(self.image_files) - 1:
            self.current_index += 1
            self.show_current_image()

    def action_previous(self, event):
        """Navigate to previous image."""
        if self.image_files and self.current_index > 0:
            self.current_index -= 1
            self.show_current_image()

    def action_skip(self, event):
        """Mark as skipped and advance (future: track skipped items)."""
        # For now, just advance without moving file
        self.action_next(event)

    def finish_culling(self):
        self.image_label.config(image="", text="--- NO MORE IMAGES ---", fg="white", font=("Arial", 24))
        self.lbl_status.config(text="Finished.")
        messagebox.showinfo("Done", "All images have been sorted!")
        self.root.quit()

if __name__ == "__main__":
    root = tk.Tk()
    app = RapidCullerApp(root)
    # Need to update idletasks to get accurate initial frame dimensions for resizing
    root.update_idletasks() 
    root.mainloop()