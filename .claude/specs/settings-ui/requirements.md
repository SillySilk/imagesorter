# Settings UI - Requirements

## Feature Overview
Add a comprehensive settings system with UI to configure button/mouse mappings, navigation controls, and folder loading options for the image culler application.

## Codebase Analysis Summary
**Existing Code to Leverage:**
- Settings persistence system (`load_settings()`, `save_settings()`) in app.py:72-105
- Event binding system (`image_label.bind()`) in app.py:65-66
- File scanning logic in `load_images_start()` at app.py:129-155
- JSON configuration file structure (`culler_settings.json`)
- Tkinter GUI framework and layout patterns

**What Needs to Be Built:**
- Settings dialog/window UI
- Configurable action mapping system
- Mouse wheel event handlers
- Recursive folder scanning capability
- Extended configuration schema

---

## Requirements

### 1. Settings UI Window

**User Story:** As a user, I want a settings window to configure application behavior, so that I can customize controls and options without editing configuration files.

#### Acceptance Criteria
1. WHEN user opens settings THEN system SHALL display a settings dialog window with tabbed or sectioned interface
2. WHEN user modifies settings THEN system SHALL validate changes before applying
3. WHEN user saves settings THEN system SHALL persist changes to `culler_settings.json`
4. WHEN user cancels settings THEN system SHALL discard changes and close dialog
5. IF settings are invalid THEN system SHALL display error message and prevent saving
6. WHEN application starts THEN system SHALL load and apply saved settings

---

### 2. Button Mapping Configuration

**User Story:** As a user, I want to configure what left and right mouse buttons do, so that I can customize the workflow to my preferences.

#### Acceptance Criteria
1. WHEN user accesses button mapping settings THEN system SHALL display available actions for left and right mouse buttons
2. WHEN user assigns action to button THEN system SHALL update button behavior immediately upon save
3. IF user assigns same action to multiple buttons THEN system SHALL allow it with a warning
4. WHEN user clicks configured button THEN system SHALL execute assigned action (keep, reject, next, previous, skip)
5. WHEN settings are reset THEN system SHALL restore default mappings (left=keep, right=reject)

**Available Actions:**
- Keep (move to keep directory)
- Reject (move to reject directory)
- Next (advance to next image without action)
- Previous (go back to previous image)
- Skip (mark as skipped, move to next)

---

### 3. Mouse Wheel Support

**User Story:** As a user, I want to use mouse wheel to navigate images, so that I can quickly browse forward and backward without clicking.

#### Acceptance Criteria
1. WHEN user scrolls wheel up THEN system SHALL navigate to previous image
2. WHEN user scrolls wheel down THEN system SHALL navigate to next image
3. WHEN at first image AND user scrolls up THEN system SHALL stay at first image
4. WHEN at last image AND user scrolls down THEN system SHALL stay at last image or show completion
5. WHEN wheel navigation is disabled in settings THEN system SHALL ignore wheel events
6. IF user scrolls during image load THEN system SHALL queue navigation after load completes

---

### 4. Configurable Wheel Actions

**User Story:** As a user, I want to configure what mouse wheel up/down does, so that I can customize navigation controls.

#### Acceptance Criteria
1. WHEN user accesses wheel mapping settings THEN system SHALL display action options for wheel up and wheel down
2. WHEN user assigns actions THEN system SHALL update wheel behavior upon save
3. WHEN wheel action is set to "disabled" THEN system SHALL ignore that wheel direction
4. WHEN wheel scrolls THEN system SHALL execute configured action
5. IF wheel action conflicts with button action THEN system SHALL allow but display warning

---

### 5. Recursive Folder Loading

**User Story:** As a user, I want to load images from subdirectories recursively, so that I can sort entire directory trees without manually selecting each folder.

#### Acceptance Criteria
1. WHEN user enables recursive loading in settings THEN system SHALL scan all subdirectories for images
2. WHEN loading recursively THEN system SHALL maintain original subdirectory structure when moving files
3. WHEN recursive loading is enabled THEN system SHALL display total count from all subdirectories
4. IF subdirectory is inaccessible THEN system SHALL log error and continue with accessible directories
5. WHEN user disables recursive loading THEN system SHALL only load images from selected directory (current behavior)
6. WHEN moving file from subdirectory THEN system SHALL create corresponding subdirectory structure in destination

---

### 6. Settings Access and UI Integration

**User Story:** As a user, I want easy access to settings from the main window, so that I can adjust configuration without restarting the application.

#### Acceptance Criteria
1. WHEN application starts THEN system SHALL display settings button or menu item
2. WHEN user clicks settings access THEN system SHALL open settings dialog
3. WHEN settings dialog is open THEN system SHALL prevent interaction with main window (modal dialog)
4. WHEN user closes settings THEN system SHALL return focus to main window
5. IF culling is in progress THEN system SHALL disable settings access or warn user that changes apply next session

---

### 7. Settings Persistence and Migration

**User Story:** As a developer, I want settings to persist across sessions and handle schema changes gracefully, so that users don't lose configuration when updating.

#### Acceptance Criteria
1. WHEN settings are saved THEN system SHALL write complete configuration to `culler_settings.json`
2. WHEN application loads settings THEN system SHALL validate JSON schema
3. IF settings file is missing THEN system SHALL create with default values
4. IF settings file has old schema THEN system SHALL migrate to new schema preserving existing values
5. WHEN migration fails THEN system SHALL backup old settings and create fresh configuration
6. WHEN settings are corrupted THEN system SHALL log error, use defaults, and notify user

---

## Technical Constraints

1. **Backward Compatibility**: Must maintain compatibility with existing `culler_settings.json` format (src, keep fields)
2. **UI Framework**: Must use Tkinter to match existing application
3. **File Operations**: Must preserve existing file move behavior and error handling
4. **Performance**: Recursive scanning should not block UI; use background loading if directory tree is large
5. **Platform**: Must work on Windows, macOS, and Linux (cross-platform Tkinter compatibility)

---

## Edge Cases and Error Handling

1. **Invalid Action Mapping**: User maps all buttons to navigation only (no keep/reject)
   - System should warn but allow configuration

2. **Recursive Loading with Symlinks**: Circular directory references
   - System should detect and skip symbolic links or limit recursion depth

3. **Settings Change During Culling**: User opens settings while actively sorting
   - System should either block settings access or defer changes to next session

4. **Missing Destination Directories**: Mapped action references non-existent directory
   - System should validate on save and show error

5. **Keyboard Shortcuts Conflict**: Future keyboard shortcuts conflict with system shortcuts
   - System should detect and warn user

---

## Non-Functional Requirements

1. **Usability**: Settings UI should be intuitive with clear labels and tooltips
2. **Responsiveness**: Settings changes should apply immediately after save (no restart required when possible)
3. **Data Integrity**: Settings corruption should never cause data loss of images
4. **Documentation**: Settings should include help text or tooltips explaining each option

---

## Out of Scope

The following are explicitly **not** included in this feature:
1. Keyboard shortcut configuration (future enhancement)
2. Custom action creation (only predefined actions: keep, reject, next, previous, skip)
3. Multi-monitor support for settings dialog
4. Import/export settings profiles
5. Undo/redo for image moves
6. Image preview in settings dialog
