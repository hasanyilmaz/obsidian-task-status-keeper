
'use strict';

const { Plugin, PluginSettingTab, Setting, Modal } = require('obsidian');

// Default settings structure
const DEFAULT_SETTINGS = {
  rightmostTagWins: false, // false = leftmost wins, true = rightmost wins
  statusToTags: {
    "/": ["incomplete"],
    "x": ["done"],
    "-": ["canceled"],
    ">": ["forwarded"],
    "<": ["scheduling"],
    "?": ["question"],
    "!": ["important"],
    "*": ["star"],
    "\"": ["quote"],
    "l": ["location"],
    "b": ["bookmark"],
    "i": ["information"],
    "S": ["savings"],
    "I": ["idea"],
    "p": ["pros"],
    "c": ["cons"],
    "f": ["fire"],
    "k": ["key"],
    "w": ["win"],
    "u": ["up"],
    "d": ["down"]
  }
};

// Protected statuses that shouldn't be auto-overridden
const PROTECTED_STATUSES = ['x', '-']; // done, canceled

// Status definitions for settings UI
const STATUS_DEFINITIONS = {
  "/": { name: "Incomplete", desc: "Task in progress" },
  "x": { name: "Done", desc: "Completed task" },
  "-": { name: "Canceled", desc: "Cancelled task" },
  ">": { name: "Forwarded", desc: "Forwarded/delegated task" },
  "<": { name: "Scheduling", desc: "Scheduled for later" },
  "?": { name: "Question", desc: "Needs clarification" },
  "!": { name: "Important", desc: "High priority task" },
  "*": { name: "Star", desc: "Starred/favorite task" },
  "\"": { name: "Quote", desc: "Quote or reference" },
  "l": { name: "Location", desc: "Location-based task" },
  "b": { name: "Bookmark", desc: "Bookmarked task" },
  "i": { name: "Information", desc: "Info or note" },
  "S": { name: "Savings", desc: "Money/savings related" },
  "I": { name: "Idea", desc: "New idea" },
  "p": { name: "Pros", desc: "Positive aspect" },
  "c": { name: "Cons", desc: "Negative aspect" },
  "f": { name: "Fire", desc: "Urgent/hot task" },
  "k": { name: "Key", desc: "Key task" },
  "w": { name: "Win", desc: "Achievement/win" },
  "u": { name: "Up", desc: "Upward progress" },
  "d": { name: "Down", desc: "Downward/decline" }
};

class TaskStatusKeeper extends Plugin {
  async onload() {
    await this.loadSettings();

    this._pendingFiles = new Map();
    this._scheduleTimer = null;

    this.registerEvent(this.app.vault.on('modify', (file) => {
      if (file && file.extension === 'md') this.scheduleProcess(file);
    }));

    this.addSettingTab(new TaskStatusKeeperSettingTab(this.app, this));
  }

  async loadSettings() {
    const savedData = await this.loadData();

    // Initialize with defaults
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

    // Migrate old format or load new format
    if (savedData) {
      // Check if new format with rightmostTagWins property exists
      if (savedData.hasOwnProperty('rightmostTagWins')) {
        // v0.5.0+ format: { rightmostTagWins, statusToTags }
        this.settings = Object.assign({}, this.settings, savedData);
      } else {
        // Check if it's old format or v0.4.x format
        const firstKey = Object.keys(savedData)[0];
        const firstValue = savedData[firstKey];

        if (typeof firstValue === 'string') {
          // Very old format: tag -> status, need to migrate
          for (const [tag, status] of Object.entries(savedData)) {
            if (this.settings.statusToTags[status]) {
              if (!this.settings.statusToTags[status].includes(tag)) {
                this.settings.statusToTags[status].push(tag);
              }
            }
          }
        } else if (Array.isArray(firstValue)) {
          // v0.4.x format: status -> tags[]
          this.settings.statusToTags = Object.assign({}, this.settings.statusToTags, savedData);
        }
      }
    }

    this._rebuildCaches();
  }

  async saveSettings() {
    this._rebuildCaches();
    await this.saveData(this.settings);
  }

  _extractDesiredFromTags(rest) {
    if (this._tagRegex) {
      this._tagRegex.lastIndex = 0;
      const matches = [];
      let m;

      // Collect all matching tags
      while ((m = this._tagRegex.exec(rest)) !== null) {
        const tag = m[1].toLowerCase();
        if (this._tagToStatus && this._tagToStatus[tag]) {
          matches.push({
            tag: tag,
            status: this._tagToStatus[tag],
            index: m.index
          });
        }
      }

      if (matches.length > 0) {
        // If rightmost wins, return the last match; otherwise return the first
        if (this.settings.rightmostTagWins) {
          return matches[matches.length - 1].status;
        } else {
          return matches[0].status;
        }
      }
    }

    if (this._todoFallbackRegex && this._todoFallbackRegex.test(rest)) return ' ';
    return null;
  }

  _rebuildCaches() {
    this._todoFallbackRegex = /\bto-?do\b/i;
    this._tagToStatus = {};

    const allTags = [];
    const statusToTags = this.settings.statusToTags || {};

    // Build reverse lookup: tag -> status
    // settings format: { statusToTags: { "status": ["tag1", "tag2", ...] } }
    for (const [status, tags] of Object.entries(statusToTags)) {
      if (!Array.isArray(tags)) continue;

      for (const tag of tags) {
        const normalized = tag.trim().toLowerCase();
        if (normalized.length > 0) {
          // First match wins - don't overwrite if tag already mapped
          if (!this._tagToStatus[normalized]) {
            this._tagToStatus[normalized] = status;
            allTags.push(normalized);
          }
        }
      }
    }

    if (!allTags.length) {
      this._tagRegex = null;
      return;
    }

    // Sort tags by length (longest first) to prevent partial matches
    const pattern = allTags
      .map((tag) => escapeRegExp(tag))
      .sort((a, b) => b.length - a.length)
      .join('|');

    this._tagRegex = new RegExp(`#(${pattern})(?=[^A-Za-z0-9_-]|$)`, 'gi');
  }

  async processFile(file) {
    try {
      const content = await this.app.vault.read(file);

      // Check if there are any checkboxes at all (not just empty ones)
      if (!this._tagRegex || content.indexOf('- [') === -1) return;

      const lines = content.split('\n');

      // Skip files with more than 5000 lines
      if (lines.length > 5000) return;

      let insideFence = false;
      const changedLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
          insideFence = !insideFence;
          continue;
        }

        if (insideFence) continue;

        // Match any checkbox status: [ ], [x], [*], [!], etc.
        const m = line.match(/^(\s*)- \[(.?)\] (.*)$/);
        if (!m) continue;

        const indent = m[1];
        const currentStatus = m[2];
        const rest = m[3];

        // Protect done [x] and canceled [-] statuses from auto-override
        // These are "final" statuses set by user clicking checkbox
        if (PROTECTED_STATUSES.includes(currentStatus)) continue;

        const desired = this._extractDesiredFromTags(rest);

        // Skip if no tags found or fallback to empty
        if (!desired || desired === ' ') continue;

        // Only update if status actually changed
        if (currentStatus !== desired) {
          const newLine = `${indent}- [${desired}] ${rest}`;
          changedLines.push({ index: i, oldLine: line, newLine });
        }
      }

      if (changedLines.length > 0) {
        // Apply changes to lines array
        for (const change of changedLines) {
          lines[change.index] = change.newLine;
        }
        await this.app.vault.modify(file, lines.join('\n'));
      }
    } catch (e) {
      console.error('TaskStatusKeeper error:', e);
    }
  }

  async scanVault(progressCallback) {
    const allFiles = this.app.vault.getMarkdownFiles();
    let filesScanned = 0;
    let filesUpdated = 0;
    let tasksUpdated = 0;

    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i];

      // Update progress
      const percentage = Math.round(((i + 1) / allFiles.length) * 100);
      if (progressCallback) {
        progressCallback(percentage, i + 1, allFiles.length);
      }

      try {
        const content = await this.app.vault.read(file);

        // Skip if no checkboxes or no tag regex
        if (!this._tagRegex || content.indexOf('- [') === -1) {
          filesScanned++;
          continue;
        }

        const lines = content.split('\n');

        // Skip files with more than 5000 lines
        if (lines.length > 5000) {
          filesScanned++;
          continue;
        }

        let insideFence = false;
        const changedLines = [];

        for (let j = 0; j < lines.length; j++) {
          const line = lines[j];
          const trimmed = line.trim();

          if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
            insideFence = !insideFence;
            continue;
          }

          if (insideFence) continue;

          // Match any checkbox status
          const m = line.match(/^(\s*)- \[(.?)\] (.*)$/);
          if (!m) continue;

          const indent = m[1];
          const currentStatus = m[2];
          const rest = m[3];

          // Protect done [x] and canceled [-] statuses
          if (PROTECTED_STATUSES.includes(currentStatus)) continue;

          const desired = this._extractDesiredFromTags(rest);

          // Skip if no tags found or fallback to empty
          if (!desired || desired === ' ') continue;

          // Only update if status actually changed
          if (currentStatus !== desired) {
            const newLine = `${indent}- [${desired}] ${rest}`;
            changedLines.push({ index: j, oldLine: line, newLine });
          }
        }

        filesScanned++;

        if (changedLines.length > 0) {
          // Apply changes to lines array
          for (const change of changedLines) {
            lines[change.index] = change.newLine;
          }
          await this.app.vault.modify(file, lines.join('\n'));
          filesUpdated++;
          tasksUpdated += changedLines.length;
        }
      } catch (e) {
        console.error('VaultScan error for file:', file.path, e);
        filesScanned++;
      }
    }

    return { filesScanned, filesUpdated, tasksUpdated };
  }

  scheduleProcess(file) {
    if (!file || !file.path) return;
    if (!this._pendingFiles) this._pendingFiles = new Map();

    this._pendingFiles.set(file.path, file);

    if (this._scheduleTimer) return;

    this._scheduleTimer = setTimeout(async () => {
      const files = Array.from(this._pendingFiles.values());
      this._pendingFiles.clear();
      this._scheduleTimer = null;

      for (const pendingFile of files) {
        try {
          await this.processFile(pendingFile);
        } catch (e) {
          console.error('TaskStatusKeeper schedule error:', e);
        }
      }
    }, 400);
  }

  onunload() {
    if (this._scheduleTimer) {
      clearTimeout(this._scheduleTimer);
      this._scheduleTimer = null;
    }
    if (this._pendingFiles) this._pendingFiles.clear();
  }
}

class VaultScanProgressModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Updating Tasks Across Vault' });

    this.progressContainer = contentEl.createDiv({ cls: 'vault-scan-progress' });
    this.progressContainer.style.padding = '20px';

    this.progressBar = this.progressContainer.createDiv();
    this.progressBar.style.width = '100%';
    this.progressBar.style.height = '20px';
    this.progressBar.style.backgroundColor = 'var(--background-modifier-border)';
    this.progressBar.style.borderRadius = '10px';
    this.progressBar.style.overflow = 'hidden';
    this.progressBar.style.marginBottom = '15px';

    this.progressFill = this.progressBar.createDiv();
    this.progressFill.style.width = '0%';
    this.progressFill.style.height = '100%';
    this.progressFill.style.backgroundColor = 'var(--interactive-accent)';
    this.progressFill.style.transition = 'width 0.3s ease';

    this.statusText = this.progressContainer.createEl('p', {
      text: 'Starting scan...',
      cls: 'vault-scan-status'
    });
    this.statusText.style.textAlign = 'center';
    this.statusText.style.marginTop = '10px';

    // Start the scan
    this.startScan();
  }

  updateProgress(percentage, current, total) {
    this.progressFill.style.width = `${percentage}%`;
    this.statusText.textContent = `Scanning: ${current} / ${total} files (${percentage}%)`;
  }

  showCompletion(stats) {
    this.progressFill.style.width = '100%';
    this.progressFill.style.backgroundColor = 'var(--interactive-success)';

    this.statusText.innerHTML = `
      <strong>Scan Complete!</strong><br><br>
      📁 Files scanned: ${stats.filesScanned}<br>
      ✏️ Files updated: ${stats.filesUpdated}<br>
      ✅ Tasks updated: ${stats.tasksUpdated}
    `;

    // Auto-close after 3 seconds
    setTimeout(() => {
      this.close();
    }, 3000);
  }

  async startScan() {
    try {
      const stats = await this.plugin.scanVault((percentage, current, total) => {
        this.updateProgress(percentage, current, total);
      });
      this.showCompletion(stats);
    } catch (e) {
      console.error('Vault scan error:', e);
      this.statusText.textContent = 'Error during scan. Check console for details.';
      this.progressFill.style.backgroundColor = 'var(--text-error)';
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class TaskStatusKeeperSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Task Status Keeper Settings' });

    // ===== GENERAL SETTINGS SECTION =====
    containerEl.createEl('h3', { text: 'General Settings' });

    new Setting(containerEl)
      .setName('Rightmost tag wins priority')
      .setDesc('When OFF (default): First tag from left determines status. When ON: Last tag from right determines status. Changing this will scan all vault files.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.rightmostTagWins || false)
        .onChange(async (value) => {
          this.plugin.settings.rightmostTagWins = value;
          await this.plugin.saveSettings();

          // Trigger vault-wide scan with progress modal
          const modal = new VaultScanProgressModal(this.app, this.plugin);
          modal.open();
        }));

    // Add detailed explanation
    const explanationEl = containerEl.createDiv({ cls: 'setting-item-description' });
    explanationEl.style.marginBottom = '20px';
    explanationEl.style.padding = '10px';
    explanationEl.style.backgroundColor = 'var(--background-secondary)';
    explanationEl.style.borderRadius = '5px';

    explanationEl.createEl('strong', { text: 'Tag Priority Examples:' });
    explanationEl.createEl('br');
    explanationEl.createEl('br');

    const leftExample = explanationEl.createDiv();
    leftExample.innerHTML = '<strong>Toggle OFF (Leftmost/First match wins):</strong><br>' +
      '<code>- [ ] task #important #star</code> → Important status wins<br>' +
      '<code>- [ ] task #star #important</code> → Star status wins';
    leftExample.style.marginBottom = '10px';

    const rightExample = explanationEl.createDiv();
    rightExample.innerHTML = '<strong>Toggle ON (Rightmost/Last added wins):</strong><br>' +
      '<code>- [ ] task #important #star</code> → Star status wins (rightmost)<br>' +
      '<code>- [ ] task #star #important</code> → Important status wins (rightmost)';

    const protectedNote = explanationEl.createDiv();
    protectedNote.style.marginTop = '10px';
    protectedNote.style.fontStyle = 'italic';
    protectedNote.innerHTML = '<strong>Note:</strong> Done [x] and Canceled [-] statuses are protected. ' +
      'They will not be auto-changed by tags until you manually uncheck them.';

    // ===== STATUS MAPPINGS SECTION =====
    containerEl.createEl('h3', { text: 'Status Tag Mappings', attr: { style: 'margin-top: 30px;' } });

    const descEl = containerEl.createEl('div', { cls: 'setting-item-description' });
    descEl.createEl('p', {
      text: 'Customize tag mappings for each status type. You can assign multiple tags (comma-separated) to each status.'
    });
    descEl.createEl('p', {
      text: 'When a recurring task contains any of these tags, it will automatically update to the corresponding checkbox status.'
    });
    descEl.createEl('p', {
      text: 'Maximum 30 tags per status.'
    });

    // Create settings for each status
    for (const [statusChar, definition] of Object.entries(STATUS_DEFINITIONS)) {
      // Get current tags for this status (array format)
      const currentTags = this.plugin.settings.statusToTags[statusChar] || [];
      const currentValue = Array.isArray(currentTags) ? currentTags.join(', ') : '';

      const setting = new Setting(containerEl)
        .setName(`${definition.name} - [${statusChar}]`)
        .setDesc(definition.desc)
        .addTextArea(text => {
          text
            .setPlaceholder('Example: star, star1, star2, redstar')
            .setValue(currentValue)
            .onChange(async (value) => {
              // Parse comma-separated tags
              const tags = value
                .split(',')
                .map(tag => tag.trim().replace(/^#/, '').toLowerCase())
                .filter(tag => tag.length > 0);

              // Limit to 30 tags
              const limitedTags = tags.slice(0, 30);

              // Update settings
              if (limitedTags.length > 0) {
                this.plugin.settings.statusToTags[statusChar] = limitedTags;
              } else {
                // Keep at least empty array for the status
                this.plugin.settings.statusToTags[statusChar] = [];
              }

              await this.plugin.saveSettings();

              // Show warning if limit exceeded
              if (tags.length > 30) {
                text.inputEl.style.borderColor = 'var(--text-error)';
                setTimeout(() => {
                  text.inputEl.style.borderColor = '';
                }, 2000);
              }
            });

          // Style textarea: takes 65% of total row width
          text.inputEl.style.width = '100%';
          text.inputEl.style.minHeight = '60px';
          text.inputEl.style.fontFamily = 'var(--font-monospace)';

          return text;
        });

      // Layout: textarea control takes 65%, label/description takes 35%
      const controlEl = setting.controlEl;
      const infoEl = setting.infoEl;

      setting.settingEl.style.display = 'flex';
      setting.settingEl.style.flexDirection = 'row-reverse'; // Reverse: control on left, info on right
      setting.settingEl.style.alignItems = 'flex-start';
      setting.settingEl.style.gap = '20px';

      // Control (textarea) takes 65% of row
      controlEl.style.flex = '0 0 65%';

      // Info (label + description) takes 35% of row
      infoEl.style.flex = '0 0 35%';
    }
  }
}

module.exports = TaskStatusKeeper;

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
