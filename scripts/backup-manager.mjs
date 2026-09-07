import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { copyDirSync } from './project-manager.mjs';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getDirSize(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return total;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += getDirSize(fullPath);
      } else {
        total += fs.statSync(fullPath).size;
      }
    }
  } catch {}
  return total;
}

function computeFileHash(filePath) {
  if (!fs.existsSync(filePath)) return '';
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  } catch {
    return '';
  }
}

export class BackupManager {
  constructor(projectDir) {
    this.projectDir = projectDir;
    this.wsDir = path.join(projectDir, '.webstudio');
    this.backupsDir = path.join(projectDir, '.webstudio-backups');
    this.registryPath = path.join(this.backupsDir, 'backups.json');
    this.ensureInitialized();
  }

  ensureInitialized() {
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }

    if (!fs.existsSync(this.registryPath)) {
      const initialRegistry = {
        config: {
          autoBackupEnabled: true,
          intervalMinutes: 10,
          backupOnImport: true
        },
        lastBackupTimestamp: null,
        lastDataHash: '',
        backups: []
      };
      fs.writeFileSync(this.registryPath, JSON.stringify(initialRegistry, null, 2) + '\n', 'utf8');
    }
  }

  loadRegistry() {
    this.ensureInitialized();
    try {
      return JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
    } catch {
      return {
        config: { autoBackupEnabled: true, intervalMinutes: 10, backupOnImport: true },
        lastBackupTimestamp: null,
        lastDataHash: '',
        backups: []
      };
    }
  }

  saveRegistry(registry) {
    fs.writeFileSync(this.registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
  }

  listBackups() {
    const reg = this.loadRegistry();
    // Validate that folders exist on disk
    const validBackups = reg.backups.filter(b => {
      const snapDir = path.join(this.backupsDir, b.folder);
      return fs.existsSync(snapDir);
    });

    if (validBackups.length !== reg.backups.length) {
      reg.backups = validBackups;
      this.saveRegistry(reg);
    }

    // Sort newest first
    validBackups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      config: reg.config,
      totalCount: validBackups.length,
      backups: validBackups
    };
  }

  getProjectStats() {
    let pagesCount = 0;
    let instancesCount = 0;
    let assetsCount = 0;

    const dataPath = path.join(this.wsDir, 'data.json');
    if (fs.existsSync(dataPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        if (Array.isArray(data.pages)) pagesCount = data.pages.length;
        else if (Array.isArray(data.build?.pages?.pages)) pagesCount = data.build.pages.pages.length;

        if (Array.isArray(data.build?.instances)) instancesCount = data.build.instances.length;
        else if (typeof data.build?.instances === 'object' && data.build?.instances) {
          instancesCount = Object.keys(data.build.instances).length;
        }

        if (Array.isArray(data.assets)) assetsCount = data.assets.length;
      } catch {}
    }

    const assetsDir = path.join(this.wsDir, 'assets');
    if (assetsCount === 0 && fs.existsSync(assetsDir)) {
      try {
        assetsCount = fs.readdirSync(assetsDir).filter(f => !f.startsWith('.')).length;
      } catch {}
    }

    const sizeBytes = getDirSize(this.wsDir);
    return {
      pagesCount,
      instancesCount,
      assetsCount,
      sizeBytes,
      formattedSize: formatBytes(sizeBytes)
    };
  }

  createBackup(customDescription = '', type = 'manual') {
    if (!fs.existsSync(this.wsDir)) {
      throw new Error('No .webstudio directory found to backup');
    }

    const now = new Date();
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    let id = `backup_${dateStr}_${timeStr}`;
    let folder = `snapshot_${dateStr}_${timeStr}`;

    let counter = 1;
    while (fs.existsSync(path.join(this.backupsDir, folder))) {
      id = `backup_${dateStr}_${timeStr}_${counter}`;
      folder = `snapshot_${dateStr}_${timeStr}_${counter}`;
      counter++;
    }
    const snapshotDir = path.join(this.backupsDir, folder);
    const dataTargetDir = path.join(snapshotDir, 'data');
    fs.mkdirSync(dataTargetDir, { recursive: true });

    // Copy entire .webstudio directory
    copyDirSync(this.wsDir, dataTargetDir);

    const stats = this.getProjectStats();
    const dataPath = path.join(this.wsDir, 'data.json');
    const currentHash = computeFileHash(dataPath);

    // Format display name
    const displayDate = now.toLocaleDateString('uk-UA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const displayTime = now.toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const displayName = `${displayDate}, ${displayTime}`;

    let description = (customDescription || '').trim();
    if (!description) {
      if (type === 'manual') description = 'Ручний знімок проєкту';
      else if (type === 'import') description = 'Автобекап після Import';
      else if (type === 'timer') description = 'Плановий автобекап';
      else if (type === 'pre-restore') description = 'Аварійний знімок перед відновленням';
      else description = 'Локальний бекап проєкту';
    }

    const meta = {
      id,
      folder,
      displayName,
      timestamp: now.toISOString(),
      description,
      type,
      stats
    };

    fs.writeFileSync(path.join(snapshotDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');

    const reg = this.loadRegistry();
    reg.backups.unshift(meta);
    reg.lastBackupTimestamp = now.toISOString();
    reg.lastDataHash = currentHash;
    this.saveRegistry(reg);

    return meta;
  }

  restoreBackup(backupId) {
    const reg = this.loadRegistry();
    const meta = reg.backups.find(b => b.id === backupId);
    if (!meta) {
      throw new Error(`Backup "${backupId}" not found in registry`);
    }

    const snapshotDir = path.join(this.backupsDir, meta.folder);
    const snapshotDataDir = path.join(snapshotDir, 'data');
    if (!fs.existsSync(snapshotDataDir)) {
      throw new Error(`Backup snapshot directory "${snapshotDataDir}" does not exist on disk`);
    }

    // Create safety backup of current state first
    try {
      this.createBackup('Аварійний знімок перед відновленням', 'pre-restore');
    } catch {}

    // Clean current .webstudio safely
    if (fs.existsSync(this.wsDir)) {
      try {
        fs.rmSync(this.wsDir, { recursive: true, force: true });
      } catch {}
    }
    fs.mkdirSync(this.wsDir, { recursive: true });

    // Restore from snapshot
    copyDirSync(snapshotDataDir, this.wsDir);

    return {
      success: true,
      restoredId: backupId,
      displayName: meta.displayName,
      restoredAt: new Date().toISOString()
    };
  }

  updateDescription(backupId, newDescription) {
    const reg = this.loadRegistry();
    const meta = reg.backups.find(b => b.id === backupId);
    if (!meta) {
      throw new Error(`Backup "${backupId}" not found`);
    }

    meta.description = (newDescription || '').trim();
    this.saveRegistry(reg);

    const metaFile = path.join(this.backupsDir, meta.folder, 'meta.json');
    if (fs.existsSync(metaFile)) {
      try {
        fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n', 'utf8');
      } catch {}
    }

    return meta;
  }

  deleteBackup(backupId) {
    const reg = this.loadRegistry();
    const idx = reg.backups.findIndex(b => b.id === backupId);
    if (idx === -1) {
      throw new Error(`Backup "${backupId}" not found`);
    }

    const [deleted] = reg.backups.splice(idx, 1);
    this.saveRegistry(reg);

    const snapshotDir = path.join(this.backupsDir, deleted.folder);
    if (fs.existsSync(snapshotDir)) {
      try {
        fs.rmSync(snapshotDir, { recursive: true, force: true });
      } catch {}
    }

    return { success: true, deletedId: backupId };
  }

  updateConfig(newConfig = {}) {
    const reg = this.loadRegistry();
    reg.config = {
      ...reg.config,
      ...newConfig
    };
    this.saveRegistry(reg);
    return reg.config;
  }

  checkAutoBackup() {
    const reg = this.loadRegistry();
    if (!reg.config.autoBackupEnabled) return null;

    const dataPath = path.join(this.wsDir, 'data.json');
    if (!fs.existsSync(dataPath)) return null;

    const currentHash = computeFileHash(dataPath);
    if (!currentHash) return null;

    // Check if changed since last backup
    if (reg.lastDataHash && reg.lastDataHash === currentHash) {
      return null; // No changes, skip creating empty duplicate
    }

    // Check if interval elapsed
    const now = Date.now();
    const intervalMs = (reg.config.intervalMinutes || 10) * 60 * 1000;
    if (reg.lastBackupTimestamp) {
      const lastTime = new Date(reg.lastBackupTimestamp).getTime();
      if (now - lastTime < intervalMs) {
        return null;
      }
    }

    // Create auto-backup
    return this.createBackup('Плановий автобекап', 'timer');
  }

  triggerImportBackup() {
    const reg = this.loadRegistry();
    if (!reg.config.backupOnImport) return null;
    return this.createBackup('Автобекап після Import/Sync', 'import');
  }
}
