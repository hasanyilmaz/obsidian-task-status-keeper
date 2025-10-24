# Task Status Keeper

An Obsidian plugin that automatically updates task checkbox statuses based on semantic tags. Works with any tasks in your vault - no dependencies on specific plugins or themes.

## Features

- 🏷️ **Tag-Based Status Updates**: Use semantic tags like `#important`, `#win`, `#scheduling` to automatically set checkbox statuses
- ⚙️ **Customizable Mappings**: Configure which tags map to which statuses in plugin settings
- 🎯 **Flexible Priority Rules**: Choose whether leftmost or rightmost tag wins when multiple tags are present
- 🔒 **Protected Statuses**: Done `[x]` and canceled `[-]` tasks won't be auto-changed
- ⚡ **Performance Optimized**: Smart debouncing and caching for smooth operation
- 🎨 **21 Status Types**: Supports extensive checkbox styles for various workflows

## Installation

### From Community Plugins (Coming Soon)
Once approved by Obsidian, you'll be able to install directly from the Community Plugins browser.

### Using BRAT (Beta Reviewers Auto-update Tool)
The easiest way to install and stay updated with the latest version:

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) if you haven't already
2. Open **Settings → BRAT → Beta Plugin List**
3. Click **Add Beta plugin**
4. Enter this repository: `hasanyilmaz/obsidian-task-status-keeper`
5. Click **Add Plugin**
6. Once installed, enable **Task Status Keeper** in Settings → Community plugins
7. BRAT will automatically notify you of updates

### From GitHub Releases
1. Download the latest release zip file from [Releases](https://github.com/hasanyilmaz/obsidian-task-status-keeper/releases)
2. Extract the files to `<vault>/.obsidian/plugins/task-status-keeper/`
3. Reload Obsidian
4. Enable the plugin in Settings → Community plugins

### Manual Installation
1. Copy `main.js`, `manifest.json`, and `versions.json` to `<vault>/.obsidian/plugins/task-status-keeper/`
2. Reload Obsidian
3. Enable the plugin in Settings → Community plugins

## Usage

Add any of the supported tags to your tasks. The plugin will automatically update the checkbox status when you save the file.

### Default Status Mappings

| Checkbox | Default Tag | Description |
|---|---|---|
| `[/]` | #incomplete | Task in progress |
| `[x]` | #done | Completed task |
| `[-]` | #canceled | Cancelled task |
| `[>]` | #forwarded | Forwarded/delegated |
| `[<]` | #scheduling | Scheduled for later |
| `[?]` | #question | Needs clarification |
| `[!]` | #important | High priority |
| `[*]` | #star | Starred/favorite |
| `["]` | #quote | Quote or reference |
| `[l]` | #location | Location-based |
| `[b]` | #bookmark | Bookmarked |
| `[i]` | #information | Info or note |
| `[S]` | #savings | Money/savings related |
| `[I]` | #idea | New idea |
| `[p]` | #pros | Positive aspect |
| `[c]` | #cons | Negative aspect |
| `[f]` | #fire | Urgent/hot task |
| `[k]` | #key | Key task |
| `[w]` | #win | Achievement/win |
| `[u]` | #up | Upward progress |
| `[d]` | #down | Downward/decline |

### Examples

```markdown
- [ ] Daily workout #win
  → Automatically becomes: - [w] Daily workout #win

- [ ] Review budget #important
  → Automatically becomes: - [!] Review budget #important

- [ ] Plan tomorrow #scheduling
  → Automatically becomes: - [<] Plan tomorrow #scheduling
```

## Configuration

Access settings via **Settings → Task Status Keeper**.

### Tag Priority Rules

Choose how the plugin handles tasks with multiple tags:

- **Leftmost tag wins (default)**: `- [ ] task #important #star` → `[!]` Important status wins
- **Rightmost tag wins**: `- [ ] task #important #star` → `[*]` Star status wins

### Customizing Tag Mappings

You can assign multiple tags (comma-separated) to each status type. For example:
- Important status `[!]`: `important, urgent, priority, critical`
- Win status `[w]`: `win, victory, success, achievement`

This allows flexible tagging while maintaining consistent status representation.

## How It Works

1. **Auto-Detection**: When you save a file, the plugin scans for task checkboxes
2. **Tag Matching**: Finds any tags that match your configured status mappings
3. **Status Update**: Updates the checkbox to the corresponding status character
4. **Protected Statuses**: Done `[x]` and canceled `[-]` statuses are never auto-changed

## Technical Details

- **Performance**: 400ms debounce on file changes to batch updates
- **Smart Scanning**: Skips code fences and files over 5000 lines
- **Case-Insensitive**: Tags work regardless of capitalization
- **Non-Intrusive**: Only updates tasks that need changing

## Support

- **Issues**: [GitHub Issues](https://github.com/hasanyilmaz/obsidian-task-status-keeper/issues)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.
