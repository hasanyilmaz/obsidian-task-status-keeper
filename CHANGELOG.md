# Changelog

All notable changes to Task Status Keeper will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-10-24

### Major Release

This is the first stable release of Task Status Keeper!

### Features

- Automatic task checkbox status updates based on semantic tags
- Support for 21 different checkbox status types
- Customizable tag-to-status mappings
- Configurable tag priority rules (leftmost vs rightmost)
- Protected statuses: Done [x] and canceled [-] tasks won't be auto-changed
- Performance optimizations: 400ms debounce, smart caching
- Vault-wide scan functionality with progress modal
- Settings UI for customizing all mappings

### Technical

- Skips code fences to avoid modifying code blocks
- Case-insensitive tag matching
- File size limit (5000 lines) for performance
- Efficient regex-based tag detection
- Settings migration from older versions

### Documentation

- Comprehensive README with examples
- MIT License
- GitHub Actions workflow for releases
- Detailed installation instructions

---

## Pre-releases

### [0.5.4] - 2024-10-15

- Added configurable tag priority rules
- Improved settings UI with better layout

### [0.3.2] - 2024-10-14

- Enhanced tag mapping system
- Multiple tags per status support

### [0.3.0] - 2024-10-14

- Initial tag-to-status mapping feature
- Basic settings interface

### [0.2.1] - 2024-10-14

- Bug fixes and stability improvements

### [0.2.0] - 2024-10-14

- Added status protection for done and canceled tasks

### [0.1.0] - 2024-10-14

- Initial release
- Basic checkbox status updates based on tags
