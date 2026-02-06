# Settings UI - Implementation Tasks

## Task Overview
This implementation plan breaks down the settings-ui feature into atomic, executable coding tasks. Tasks are organized in 5 phases and prioritize reusing existing code patterns from app.py.

---

## Phase 1: Core Infrastructure

- [x] 1. Implement ConfigManager class
  - Create ConfigManager class with DEFAULT_CONFIG schema including button_mappings, wheel_mappings, and options
  - Implement load() method extending existing JSON loading pattern from app.py:72-93
  - Implement save() method extending existing JSON saving pattern from app.py:95-105
  - Implement validate() method to check config schema and valid action names
  - Implement migrate() method to convert v1 config (src, keep) to v2 schema
  - Add get(key_path) and set(key_path, value) helper methods for dot notation access
  - _Leverage: app.py:72-105 (load_settings, save_settings), json module, os.path for file operations_
  - _Requirements: 1.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 2. Integrate ConfigManager into RapidCullerApp
  - Add self.config_manager = ConfigManager() to __init__ in app.py:16
  - Replace existing load_settings() call with config_manager.load()
  - Update self.src_dir and self.keep_dir from loaded config
  - Replace save_settings() calls with config_manager.save()
  - Ensure backward compatibility with existing culler_settings.json
  - _Leverage: app.py:69, app.py:72-105, existing __init__ pattern_
  - _Requirements: 1.6, 7.1_

- [x] 3. Add apply_config() method to RapidCullerApp
  - Create apply_config(config) method that updates internal state from config dict
  - Apply button mappings, wheel mappings, and recursive loading flag
  - Update UI labels if needed to reflect current mappings
  - Call this method after loading config on startup
  - _Leverage: app.py __init__ pattern, existing state management_
  - _Requirements: 1.2, 6.4_

---

## Phase 2: Action System

- [x] 4. Add new action handler methods to RapidCullerApp
  - Implement action_next(event) - advance to next image without moving file
  - Implement action_previous(event) - go back to previous image
  - Implement action_skip(event) - advance without moving (calls action_next)
  - Ensure boundary checks (don't go below 0 or above len(image_files))
  - Call show_current_image() after index changes
  - _Leverage: app.py:213-221 (action_keep, action_reject), app.py:157-185 (show_current_image)_
  - _Requirements: 2.4, 3.1, 3.2, 3.3, 3.4_

- [x] 5. Implement ActionMapper class
  - Create ActionMapper class with ACTIONS dict mapping action names to method names
  - Implement __init__(app_instance) to store reference to RapidCullerApp
  - Implement bind_all(config) to bind all button and wheel events based on config
  - Implement unbind_all() to remove existing event bindings from image_label
  - Implement _bind_buttons(button_config) to bind left/right click events
  - Implement _bind_wheel(wheel_config) to bind wheel events (<MouseWheel>, <Button-4>, <Button-5>)
  - Implement _create_handler(action_name) to return lambda calling appropriate action method
  - Handle "disabled" action by not binding event
  - _Leverage: app.py:65-66 (image_label.bind pattern), existing event handler signatures_
  - _Requirements: 2.2, 2.4, 3.1, 3.2, 4.2, 4.3_

- [x] 6. Integrate ActionMapper into RapidCullerApp
  - Add self.action_mapper = ActionMapper(self) to __init__ in app.py
  - Remove hardcoded image_label.bind() calls from __init__ (lines 65-66)
  - Call self.action_mapper.bind_all(config) in apply_config() method
  - Ensure event bindings update when config changes
  - _Leverage: app.py:65-66, app.py __init__ pattern_
  - _Requirements: 2.2, 6.4_

---

## Phase 3: Settings UI

- [x] 7. Implement SettingsDialog class structure
  - Create SettingsDialog class with __init__(parent, config_manager)
  - Store references to parent window and config_manager
  - Create show() method that creates modal Toplevel window
  - Set window properties: title="Settings", geometry="500x400", transient, grab_set
  - Initialize self.temp_config as deep copy of current config
  - Create self.widgets dict to store UI control references
  - _Leverage: tkinter.Toplevel, app.py Frame/Button patterns, app.py:10-14 (window setup)_
  - _Requirements: 1.1, 6.1, 6.2, 6.3_

- [x] 8. Build button mappings section in SettingsDialog
  - Implement _build_button_mappings_section(parent_frame) method
  - Create LabelFrame with title "Button Mappings"
  - Add Label + OptionMenu for "Left Click" with action options
  - Add Label + OptionMenu for "Right Click" with action options
  - Action options: Keep, Reject, Next, Previous, Skip, Disabled
  - Store OptionMenu variables in self.widgets dict
  - Use Grid layout following app.py:33-45 pattern
  - _Leverage: tkinter.LabelFrame, tkinter.OptionMenu, app.py:28-62 (Frame/Grid layout)_
  - _Requirements: 2.1, 2.5, 6.1_

- [x] 9. Build wheel mappings section in SettingsDialog
  - Implement _build_wheel_mappings_section(parent_frame) method
  - Create LabelFrame with title "Mouse Wheel Mappings"
  - Add Label + OptionMenu for "Wheel Up" with action options
  - Add Label + OptionMenu for "Wheel Down" with action options
  - Action options: Keep, Reject, Next, Previous, Skip, Disabled
  - Store OptionMenu variables in self.widgets dict
  - Use Grid layout following app.py:33-45 pattern
  - _Leverage: tkinter.LabelFrame, tkinter.OptionMenu, app.py:28-62 (Frame/Grid layout)_
  - _Requirements: 4.1, 4.3, 6.1_

- [x] 10. Build options section in SettingsDialog
  - Implement _build_options_section(parent_frame) method
  - Create LabelFrame with title "Loading Options"
  - Add Checkbutton for "Load images from subdirectories recursively"
  - Store Checkbutton variable in self.widgets dict
  - Use Grid/Pack layout following app.py patterns
  - _Leverage: tkinter.Checkbutton, tkinter.LabelFrame, app.py:28-62 (Frame layout)_
  - _Requirements: 5.1, 5.5, 6.1_

- [x] 11. Build dialog button bar in SettingsDialog
  - Implement _build_button_bar(parent_frame) method
  - Create Frame for buttons at bottom of dialog
  - Add "Reset Defaults" button calling _reset_to_defaults()
  - Add "Cancel" button calling _cancel()
  - Add "Save" button calling _validate_and_save()
  - Style buttons following app.py:32, 44 pattern
  - Use Pack layout with side="left"/"right"
  - _Leverage: tkinter.Button, app.py:32-45 (Button styling and layout)_
  - _Requirements: 1.3, 1.4, 2.5, 6.4_

- [x] 12. Implement SettingsDialog UI assembly in show()
  - Call _build_button_mappings_section() and pack into main dialog
  - Call _build_wheel_mappings_section() and pack into main dialog
  - Call _build_options_section() and pack into main dialog
  - Call _build_button_bar() and pack at bottom
  - Populate widgets with values from self.temp_config
  - Call dialog.wait_window() to make dialog modal
  - _Leverage: tkinter pack/grid layout, app.py:28-62 (layout patterns)_
  - _Requirements: 1.1, 6.3_

- [x] 13. Implement settings validation and save in SettingsDialog
  - Implement _validate_and_save() method
  - Read values from all self.widgets and update self.temp_config
  - Call config_manager.validate(temp_config) to check validity
  - If invalid, show messagebox.showerror and return
  - Implement _check_warnings() to detect potentially problematic configs (e.g., no keep/reject buttons)
  - If warnings exist, show messagebox.askyesno asking user to proceed
  - If valid/confirmed, call config_manager.save(temp_config)
  - Call parent.apply_config(temp_config) to apply changes immediately
  - Close dialog with dialog.destroy()
  - _Leverage: tkinter.messagebox, app.py:143, 205 (messagebox usage), config_manager.validate()_
  - _Requirements: 1.2, 1.3, 1.5, 2.3, 4.5, 6.4_

- [x] 14. Implement cancel and reset handlers in SettingsDialog
  - Implement _cancel() method that closes dialog without saving (dialog.destroy())
  - Implement _reset_to_defaults() method that loads ConfigManager.DEFAULT_CONFIG
  - Update all widgets to show default values
  - Update self.temp_config with defaults
  - _Leverage: ConfigManager.DEFAULT_CONFIG, tkinter widget configuration_
  - _Requirements: 1.4, 2.5_

- [x] 15. Add settings button to main window
  - Add "⚙ Settings" button to control_frame in app.py after btn_load
  - Style with bg="#6c757d", fg="white"
  - Grid at row=2, column=2, sticky="e"
  - Set command=self.open_settings
  - Adjust control_frame.columnconfigure to accommodate new button
  - _Leverage: app.py:32-45 (button creation and grid layout)_
  - _Requirements: 6.1, 6.2_

- [x] 16. Implement open_settings() method in RapidCullerApp
  - Create open_settings() method in RapidCullerApp class
  - Check if culling is in progress (len(image_files) > 0 and btn_load is disabled)
  - If in progress, show warning that changes apply next session (optional, can just disable button)
  - Create SettingsDialog instance passing self.root and self.config_manager
  - Call dialog.show() to display modal dialog
  - _Leverage: app.py:108-122 (method pattern), tkinter messagebox_
  - _Requirements: 6.1, 6.2, 6.5_

---

## Phase 4: Recursive Loading

- [x] 17. Implement RecursiveScanner class
  - Create RecursiveScanner class with VALID_EXTENSIONS constant
  - Implement scan(root_dir, recursive) static method that routes to _scan_recursive or _scan_flat
  - Implement _scan_flat(root_dir) to scan only root directory (current behavior)
  - Return list of dicts with keys: filename, relative_path (empty string), full_path
  - Implement _scan_recursive(root_dir) using os.walk
  - Filter out symlinks in dirnames list to prevent infinite loops
  - Handle PermissionError by logging and continuing
  - Calculate relative_path using os.path.relpath (set to "" if ".")
  - Return list of ImageInfo dicts with filename, relative_path, full_path
  - Implement _is_valid_image(filename) static method checking extension
  - _Leverage: app.py:136-146 (file scanning logic), os.walk, os.path module_
  - _Requirements: 5.1, 5.3, 5.4, 5.5_

- [x] 18. Update load_images_start() to use RecursiveScanner
  - Import RecursiveScanner at top of app.py
  - Replace manual file scanning (lines 136-141) with RecursiveScanner.scan()
  - Pass self.config_manager.get("options.recursive_loading", False) as recursive parameter
  - Update self.image_files to store list of ImageInfo dicts instead of filenames
  - Sort by full_path to maintain consistent order
  - Update status label to show total count from all directories
  - _Leverage: RecursiveScanner.scan(), app.py:129-155, config_manager.get()_
  - _Requirements: 5.1, 5.3, 5.5_

- [x] 19. Update show_current_image() to use ImageInfo dict
  - Access current image using self.image_files[self.current_index] (now a dict)
  - Replace filename variable with image_info["filename"]
  - Replace full_path construction with image_info["full_path"]
  - Update status label to show relative_path if present (e.g., "subdir/image.png")
  - Keep all other logic unchanged (PIL Image.open, thumbnail, etc.)
  - _Leverage: app.py:157-185 (show_current_image), ImageInfo dict structure_
  - _Requirements: 5.1, 5.3_

- [x] 20. Enhance move_and_advance() to preserve subdirectory structure
  - Rename move_and_advance() to move_and_advance_recursive() or extend existing method
  - Access image_info dict from self.image_files[self.current_index]
  - Check if image_info["relative_path"] is non-empty
  - If relative_path exists, construct destination subdirectory path
  - Use os.makedirs(dest_subdir, exist_ok=True) to create subdirectories
  - Move file to appropriate subdirectory maintaining structure
  - Keep existing filename uniqueness logic (lines 194-199)
  - Keep existing error handling pattern (lines 204-206)
  - Advance index and call show_current_image() as before
  - _Leverage: app.py:187-211 (move_and_advance), os.makedirs, shutil.move, existing error handling_
  - _Requirements: 5.2, 5.6_

- [x] 21. Update action_keep() and action_reject() to use enhanced move
  - Modify action_keep() to call updated move_and_advance_recursive() with self.keep_dir
  - Modify action_reject() to call updated move_and_advance_recursive() with self.reject_dir
  - Ensure ImageInfo dict is passed correctly
  - _Leverage: app.py:213-221 (action_keep, action_reject)_
  - _Requirements: 2.4, 5.2, 5.6_

---

## Phase 5: Testing & Polish

- [x] 22. Test ConfigManager functionality
  - Manually test loading existing v1 config (should migrate to v2)
  - Test loading v2 config (should load correctly)
  - Test loading missing config (should create defaults)
  - Test loading corrupted JSON (should show error and use defaults)
  - Test validate() rejects invalid action names
  - Test validate() accepts all valid action combinations
  - Test save() persists config correctly
  - _Leverage: culler_settings.json, ConfigManager class_
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_

- [x] 23. Test ActionMapper event bindings
  - Test that button clicks execute configured actions
  - Configure left click to "next" and verify image advances without moving
  - Configure right click to "previous" and verify going back works
  - Test mouse wheel up/down events execute configured actions
  - Test "disabled" action prevents event from doing anything
  - Test rebinding (changing config and reapplying) updates bindings correctly
  - _Leverage: app.py manual testing, test image directory_
  - _Requirements: 2.2, 2.4, 3.1, 3.2, 4.2, 4.4_

- [x] 24. Test SettingsDialog UI and persistence
  - Open settings dialog and verify all sections display correctly
  - Change button mappings and save - verify they persist and apply
  - Change wheel mappings and save - verify they persist and apply
  - Toggle recursive loading and save - verify it persists
  - Test Cancel button discards changes
  - Test Reset Defaults button restores default config
  - Test validation error when attempting to save invalid config
  - Test warning when no keep/reject buttons mapped
  - _Leverage: SettingsDialog, ConfigManager, manual testing_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.3, 4.1, 6.1, 6.2, 6.3, 6.4_

- [x] 25. Test recursive folder loading
  - Create test directory structure with subdirectories containing images
  - Enable recursive loading in settings
  - Load images and verify all subdirectories are scanned
  - Verify status label shows total count from all directories
  - Move files to keep/reject and verify subdirectory structure is preserved in destinations
  - Verify _REJECTS folder maintains subdirectory structure
  - Test with symlink (should be skipped)
  - Test with permission-denied directory (should log error and continue)
  - Disable recursive loading and verify only root directory is scanned
  - _Leverage: RecursiveScanner, app.py, test directory tree_
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 26. Test cross-platform mouse wheel events
  - Test on Windows: <MouseWheel> event
  - Test on macOS: <Button-4> and <Button-5> events (if available)
  - Test on Linux: <Button-4> and <Button-5> events (if available)
  - Verify wheel up/down execute correct actions on each platform
  - Verify disabled wheel actions prevent wheel events
  - _Leverage: ActionMapper._bind_wheel(), test on available platforms_
  - _Requirements: 3.1, 3.2, 3.5, 4.2_

- [x] 27. Update instruction label to reflect configurable controls
  - Change hardcoded "LEFT CLICK = Keep Image | RIGHT CLICK = Reject Image" label in app.py:53
  - Replace with dynamic text that reads from current config
  - Show current button and wheel mappings (e.g., "L-Click: Keep | R-Click: Reject | Wheel: Navigate")
  - Update this label in apply_config() when settings change
  - Keep label concise to fit in UI
  - _Leverage: app.py:53, config_manager.get(), tkinter Label.config()_
  - _Requirements: 6.4_

- [x] 28. Add error handling for edge cases
  - Handle case where destination directories don't exist when moving files recursively
  - Handle case where user deletes destination folders while app is running
  - Handle case where source directory is deleted during culling
  - Add try/except around config_manager.load() in case of filesystem issues
  - Ensure all file operations handle permission errors gracefully
  - Log errors to console for debugging
  - _Leverage: app.py:92-93, 142-144, 204-206 (existing error handling patterns)_
  - _Requirements: 7.6_

---

## Implementation Complete

After completing all tasks:
- All requirements (1.1-7.6) implemented
- Settings UI fully functional with modal dialog
- Button and wheel mappings configurable and persistent
- Recursive folder loading working with structure preservation
- Configuration validated and migrated automatically
- Cross-platform mouse wheel support
- Backward compatible with existing configs

**Total Tasks:** 28
**Estimated Lines of Code:** ~800-1000 new lines
**Estimated Time:** 8-12 hours of focused development
