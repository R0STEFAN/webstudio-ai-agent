import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultRootDir = path.resolve(__dirname, '..');

export function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export class ProjectManager {
  constructor(rootDir = defaultRootDir) {
    this.rootDir = rootDir;
    this.projectsDir = path.join(rootDir, 'projects');
    this.registryPath = path.join(this.projectsDir, 'registry.json');
    this.ensureInitialized();
  }

  ensureInitialized() {
    if (!fs.existsSync(this.projectsDir)) {
      fs.mkdirSync(this.projectsDir, { recursive: true });
    }

    if (!fs.existsSync(this.registryPath)) {
      const initialRegistry = {
        activeProjectId: 'tattoo-v3-test',
        projects: []
      };

      // Detect legacy / root project
      const rootWsDir = path.join(this.rootDir, '.webstudio');
      let rootProjectName = 'tattoo-v3-test';

      const pkgPath = path.join(this.rootDir, 'package.json');
      const tomlPath = path.join(this.rootDir, 'wrangler.toml');
      if (fs.existsSync(tomlPath)) {
        try {
          const m = fs.readFileSync(tomlPath, 'utf8').match(/^name\s*=\s*"([^"]+)"/m);
          if (m) rootProjectName = m[1].trim();
        } catch {}
      } else if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.name && pkg.name !== 'webstudio-ai-agent') rootProjectName = pkg.name;
        } catch {}
      }

      const defaultProjectDir = path.join(this.projectsDir, rootProjectName);
      if (!fs.existsSync(defaultProjectDir)) {
        fs.mkdirSync(defaultProjectDir, { recursive: true });
        if (fs.existsSync(rootWsDir)) {
          copyDirSync(rootWsDir, path.join(defaultProjectDir, '.webstudio'));
        }
        if (fs.existsSync(tomlPath)) {
          try {
            fs.copyFileSync(tomlPath, path.join(defaultProjectDir, 'wrangler.toml'));
          } catch {}
        }
      }

      initialRegistry.activeProjectId = rootProjectName;
      initialRegistry.projects.push({
        id: rootProjectName,
        name: rootProjectName,
        directory: path.relative(this.rootDir, defaultProjectDir).replace(/\\/g, '/'),
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
      });

      fs.writeFileSync(this.registryPath, JSON.stringify(initialRegistry, null, 2) + '\n', 'utf8');
    }
  }

  loadRegistry() {
    this.ensureInitialized();
    try {
      const content = fs.readFileSync(this.registryPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return { activeProjectId: '', projects: [] };
    }
  }

  saveRegistry(registry) {
    fs.writeFileSync(this.registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
  }

  getActiveProject() {
    const reg = this.loadRegistry();
    let project = reg.projects.find(p => p.id === reg.activeProjectId);
    if (!project && reg.projects.length > 0) {
      project = reg.projects[0];
      reg.activeProjectId = project.id;
      this.saveRegistry(reg);
    }
    return project || null;
  }

  getActiveProjectDir() {
    const active = this.getActiveProject();
    if (active) {
      const fullPath = path.resolve(this.rootDir, active.directory);
      if (fs.existsSync(fullPath)) return fullPath;
    }
    return this.rootDir;
  }

  getProjectStats(projectDir) {
    const wsDir = path.join(projectDir, '.webstudio');
    let pagesCount = 0;
    let instancesCount = 0;
    let assetsCount = 0;
    let lastModified = null;

    const dataPath = path.join(wsDir, 'data.json');
    if (fs.existsSync(dataPath)) {
      try {
        const stat = fs.statSync(dataPath);
        lastModified = stat.mtime.toISOString();
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

    const assetsDir = path.join(wsDir, 'assets');
    if (assetsCount === 0 && fs.existsSync(assetsDir)) {
      try {
        assetsCount = fs.readdirSync(assetsDir).filter(f => !f.startsWith('.')).length;
      } catch {}
    }

    return { pagesCount, instancesCount, assetsCount, lastModified };
  }

  listProjects() {
    const reg = this.loadRegistry();
    const result = [];

    for (const p of reg.projects) {
      const fullDir = path.resolve(this.rootDir, p.directory);
      const stats = fs.existsSync(fullDir) ? this.getProjectStats(fullDir) : { pagesCount: 0, instancesCount: 0, assetsCount: 0, lastModified: p.lastModified };
      result.push({
        ...p,
        isActive: p.id === reg.activeProjectId,
        pagesCount: stats.pagesCount,
        instancesCount: stats.instancesCount,
        assetsCount: stats.assetsCount,
        lastModified: stats.lastModified || p.lastModified || p.createdAt
      });
    }

    // Sort by lastModified descending (newest activity first)
    result.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
    return {
      activeProjectId: reg.activeProjectId,
      projects: result
    };
  }

  createProject(rawName, description = '') {
    if (!rawName || typeof rawName !== 'string') {
      throw new Error('Project name is required');
    }

    const safeName = rawName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
    if (!safeName) {
      throw new Error('Project name contains only invalid characters');
    }

    const reg = this.loadRegistry();
    if (reg.projects.some(p => p.id === safeName)) {
      throw new Error(`Project with name "${safeName}" already exists`);
    }

    const projectDir = path.join(this.projectsDir, safeName);
    const wsDir = path.join(projectDir, '.webstudio');
    const assetsDir = path.join(wsDir, 'assets');
    fs.mkdirSync(assetsDir, { recursive: true });

    // Initial minimalist Webstudio project structure
    const initialData = {
      version: 1,
      projectId: safeName,
      pages: [
        {
          id: 'page_home',
          name: 'Home',
          path: '/'
        }
      ],
      build: {
        projectId: safeName,
        instances: {},
        props: {}
      }
    };

    fs.writeFileSync(path.join(wsDir, 'data.json'), JSON.stringify(initialData, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(wsDir, 'config.json'), JSON.stringify({ projectId: safeName }, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(projectDir, 'wrangler.toml'), `name = "${safeName}"\ncompatibility_date = "2024-04-05"\npages_build_output_dir="./build"\n`, 'utf8');

    const newProject = {
      id: safeName,
      name: safeName,
      description: description || '',
      directory: path.relative(this.rootDir, projectDir).replace(/\\/g, '/'),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    reg.projects.push(newProject);
    reg.activeProjectId = safeName;
    this.saveRegistry(reg);

    // Mirror to root .webstudio for external CLI compatibility
    this.syncActiveToRoot(projectDir);

    return newProject;
  }

  selectProject(projectId) {
    const reg = this.loadRegistry();
    const project = reg.projects.find(p => p.id === projectId);
    if (!project) {
      throw new Error(`Project "${projectId}" not found`);
    }

    reg.activeProjectId = project.id;
    this.saveRegistry(reg);

    const fullDir = path.resolve(this.rootDir, project.directory);
    this.syncActiveToRoot(fullDir);

    return project;
  }

  deleteProject(projectId) {
    const reg = this.loadRegistry();
    if (reg.projects.length <= 1) {
      throw new Error('Cannot delete the last remaining project');
    }

    const idx = reg.projects.findIndex(p => p.id === projectId);
    if (idx === -1) {
      throw new Error(`Project "${projectId}" not found`);
    }

    const [deleted] = reg.projects.splice(idx, 1);
    if (reg.activeProjectId === projectId) {
      reg.activeProjectId = reg.projects[0].id;
      const nextDir = path.resolve(this.rootDir, reg.projects[0].directory);
      this.syncActiveToRoot(nextDir);
    }

    this.saveRegistry(reg);

    const fullDir = path.resolve(this.rootDir, deleted.directory);
    if (fs.existsSync(fullDir) && fullDir.startsWith(this.projectsDir)) {
      try {
        fs.rmSync(fullDir, { recursive: true, force: true });
      } catch {}
    }

    return { success: true, deletedId: projectId, activeProjectId: reg.activeProjectId };
  }

  renameProject(projectId, newName) {
    if (!newName || typeof newName !== 'string') {
      throw new Error('New project name is required');
    }

    const safeName = newName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
    if (!safeName) {
      throw new Error('Invalid project name');
    }

    const reg = this.loadRegistry();
    const project = reg.projects.find(p => p.id === projectId);
    if (!project) {
      throw new Error(`Project "${projectId}" not found`);
    }

    if (projectId !== safeName && reg.projects.some(p => p.id === safeName)) {
      throw new Error(`Project "${safeName}" already exists`);
    }

    project.name = safeName;
    project.lastModified = new Date().toISOString();

    const fullDir = path.resolve(this.rootDir, project.directory);
    const tomlPath = path.join(fullDir, 'wrangler.toml');
    if (fs.existsSync(tomlPath)) {
      try {
        let toml = fs.readFileSync(tomlPath, 'utf8');
        toml = toml.replace(/^name\s*=\s*"[^"]+"/m, `name = "${safeName}"`);
        fs.writeFileSync(tomlPath, toml, 'utf8');
      } catch {}
    }

    this.saveRegistry(reg);
    if (reg.activeProjectId === projectId) {
      this.syncActiveToRoot(fullDir);
    }

    return project;
  }

  syncActiveToRoot(activeProjectDir) {
    const activeWs = path.join(activeProjectDir, '.webstudio');
    const rootWs = path.join(this.rootDir, '.webstudio');

    if (fs.existsSync(activeWs)) {
      copyDirSync(activeWs, rootWs);
    }

    const activeToml = path.join(activeProjectDir, 'wrangler.toml');
    const rootToml = path.join(this.rootDir, 'wrangler.toml');
    if (fs.existsSync(activeToml)) {
      try {
        fs.copyFileSync(activeToml, rootToml);
      } catch {}
    }
  }

  syncRootToActive() {
    const activeDir = this.getActiveProjectDir();
    if (activeDir === this.rootDir) return;

    const rootWs = path.join(this.rootDir, '.webstudio');
    const activeWs = path.join(activeDir, '.webstudio');

    if (fs.existsSync(rootWs)) {
      copyDirSync(rootWs, activeWs);
    }

    const rootToml = path.join(this.rootDir, 'wrangler.toml');
    const activeToml = path.join(activeDir, 'wrangler.toml');
    if (fs.existsSync(rootToml)) {
      try {
        fs.copyFileSync(rootToml, activeToml);
      } catch {}
    }
  }
}
