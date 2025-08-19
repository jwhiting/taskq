# Yarn Berry PnP Isolation Strategies for DevContainers

## Problem Statement

When using Yarn Berry with Plug'n'Play (PnP) in a DevContainer environment, **native modules** like `better-sqlite3` create cross-platform conflicts:

- **Host environment**: macOS (arm64/x86_64) compiles native modules for Darwin
- **Container environment**: Linux (x86_64/arm64) compiles native modules for Linux
- **Shared files**: PnP files (`.pnp.cjs`, `.pnp.loader.mjs`) and Yarn state contain platform-specific paths and binary references

**Result**: Switching between host and container requires rebuilding native modules, causing development friction.

## Current Project Setup

```yaml
# .yarnrc.yml
nodeLinker: pnp
enableGlobalCache: false
```

```json
// .devcontainer/devcontainer.json (current)
"mounts": [
  "target=/workspace/.yarn/cache,type=volume",
  "target=/workspace/.yarn/unplugged,type=volume"
]
```

**Files that need isolation:**

- `.pnp.cjs` - Contains platform-specific module paths
- `.pnp.loader.mjs` - Contains platform-specific loader logic
- `.yarn/install-state.gz` - Contains platform-specific build state
- `.yarn/build-state.yml` - Contains platform-specific build state
- `.yarn/cache/` - Contains platform-specific compiled modules
- `.yarn/unplugged/` - Contains platform-specific unpacked modules

## ❌ Strategies That DON'T Work

### ❌ Individual File Volume Mounts

```json
// This FAILS - Docker can't mount individual files as volumes
"mounts": [
  "target=/workspace/.pnp.cjs,type=volume",  // ❌ Not supported
  "target=/workspace/.pnp.loader.mjs,type=volume"  // ❌ Not supported
]
```

### ❌ Partial .yarn Directory Isolation

```json
// This FAILS - PnP files remain shared
"mounts": [
  "target=/workspace/.yarn/cache,type=volume",     // ✅ Isolated
  "target=/workspace/.yarn/unplugged,type=volume"  // ✅ Isolated
]
// But .pnp.cjs and .pnp.loader.mjs are still shared! ❌
```

## ✅ Working Solutions

### Solution 1: 🥇 Environment-Specific PnP Paths

**Strategy**: Use Yarn's configuration to create platform-specific PnP file locations.

#### Implementation

```yaml
# .yarnrc.yml
compressionLevel: mixed
enableTelemetry: false
nodeLinker: pnp
enableGlobalCache: false

# Environment-aware file locations
pnpDataPath: .yarn/pnp-${CONTAINER_ENV:-host}/pnp.cjs
pnpLoaderPath: .yarn/pnp-${CONTAINER_ENV:-host}/pnp.loader.mjs
cacheFolder: .yarn/cache-${CONTAINER_ENV:-host}
installStatePath: .yarn/install-state-${CONTAINER_ENV:-host}.gz

packageExtensions:
  better-sqlite3@*:
    dependencies:
      '@types/better-sqlite3': '*'
```

```json
// .devcontainer/devcontainer.json
{
  "remoteEnv": {
    "CONTAINER_ENV": "container"
  },
  "mounts": ["target=/workspace/.yarn,type=volume"]
}
```

#### Results

- **Host**: `.pnp.cjs`, `.pnp.loader.mjs`, `.yarn/cache-host/`, `.yarn/install-state-host.gz`
- **Container**: `.yarn/pnp-container/pnp.cjs`, `.yarn/pnp-container/pnp.loader.mjs`, `.yarn/cache-container/`, `.yarn/install-state-container.gz`

#### Pros

- ✅ **True isolation** - No shared state between environments
- ✅ **Leverages Yarn's built-in capabilities** - Uses official configuration
- ✅ **Minimal DevContainer changes** - Only environment variable needed
- ✅ **Automatic** - No manual rebuilds required
- ✅ **Preserves current workflow** - No major mount restructuring

#### Cons

- ⚠️ **Yarn version dependency** - Requires Yarn Berry with PnP path configuration support
- ⚠️ **Documentation sparse** - Less common configuration pattern
- ⚠️ **Initial setup** - Both environments need separate `yarn install`

### Solution 2: 🥈 Complete .yarn Directory Isolation

**Strategy**: Mount entire `.yarn` directory as volume, but PnP files remain shared.

#### Implementation

```json
// .devcontainer/devcontainer.json
"mounts": [
  "target=/workspace/.yarn,type=volume"
]
```

#### Results

- **Isolated**: `.yarn/cache/`, `.yarn/unplugged/`, `.yarn/install-state.gz`, `.yarn/build-state.yml`
- **Still shared**: `.pnp.cjs`, `.pnp.loader.mjs` ❌

#### Pros

- ✅ **Simple implementation** - Single mount point
- ✅ **Most Yarn state isolated** - Cache and build artifacts separated

#### Cons

- ❌ **Incomplete isolation** - PnP files still shared, conflicts remain
- ❌ **VS Code integration issues** - `.yarn/sdks/` needs regeneration in container
- ❌ **Doesn't solve the core problem** - Native module conflicts persist

### ❌ Solution 3: Complete Project Isolation (DOESN'T WORK)

**Strategy**: Mount entire workspace as volume, bind-mount only source files.

#### Implementation

```json
// .devcontainer/devcontainer.json
{
  "workspaceMount": "source=taskq-workspace-${devcontainerId},target=/workspace,type=volume",
  "mounts": [
    "source=${localWorkspaceFolder}/src,target=/workspace/src,type=bind",
    "source=${localWorkspaceFolder}/tests,target=/workspace/tests,type=bind",
    "source=${localWorkspaceFolder}/package.json,target=/workspace/package.json,type=bind", // ❌ FAILS
    "source=${localWorkspaceFolder}/yarn.lock,target=/workspace/yarn.lock,type=bind", // ❌ FAILS
    "source=${localWorkspaceFolder}/.yarnrc.yml,target=/workspace/.yarnrc.yml,type=bind" // ❌ FAILS
  ]
}
```

#### Why This FAILS

- ❌ **Individual file mounts don't work** - Docker can't bind-mount individual files as mounts
- ❌ **Same limitation as Solution 1's rejected approach** - File-level mounting not supported
- ❌ **Would require directory-level mounts** - But then you lose isolation benefits

### Solution 4: 🔧 Rebuild-on-Switch Scripts

**Strategy**: Detect environment changes and automatically rebuild native modules.

#### Implementation

```javascript
// scripts/check-native-modules.js
const { execSync } = require('child_process');
const fs = require('fs');

const platformFile = '.yarn/.platform';
const currentPlatform = `${process.platform}-${process.arch}`;
let lastPlatform = '';

if (fs.existsSync(platformFile)) {
  lastPlatform = fs.readFileSync(platformFile, 'utf8').trim();
}

if (lastPlatform !== currentPlatform) {
  console.log(`Platform changed from ${lastPlatform} to ${currentPlatform}`);
  execSync('yarn rebuild better-sqlite3', { stdio: 'inherit' });
  fs.writeFileSync(platformFile, currentPlatform);
}
```

```json
// package.json
{
  "scripts": {
    "postinstall": "node scripts/check-native-modules.js"
  }
}
```

#### Pros

- ✅ **Automatic detection** - Rebuilds only when needed
- ✅ **No DevContainer changes** - Works with current setup
- ✅ **Transparent** - Handles rebuilds behind the scenes

#### Cons

- ❌ **Rebuild overhead** - Still requires compilation time when switching
- ❌ **Script maintenance** - Custom logic to maintain
- ❌ **Not foolproof** - Platform detection may miss edge cases

## 🎯 Recommendations

### For TaskQ Project: **Solution 1** (Environment-Specific PnP Paths)

**Why**:

- Most elegant solution leveraging Yarn's built-in capabilities
- True isolation without complex mount management
- Minimal changes to existing DevContainer setup
- Automatic operation once configured

### Implementation Priority:

1. **Try Solution 1 first** - Test if Yarn Berry supports the PnP path configuration
2. **Fallback to Solution 4** - If path configuration doesn't work, use rebuild scripts
3. **Avoid Solution 2** - Incomplete isolation doesn't solve the problem
4. **❌ Solution 3 is not viable** - Individual file mounts don't work in Docker

## Testing Steps

1. **Verify current Yarn version supports PnP path configuration**:

   ```bash
   yarn --version
   # Check Yarn Berry documentation for pnpDataPath support
   ```

2. **Test Solution 1**:

   ```bash
   # On host
   CONTAINER_ENV=host yarn install

   # In container
   CONTAINER_ENV=container yarn install

   # Verify separate PnP files created
   ls .yarn/pnp-*/
   ```

3. **Validate native module isolation**:
   ```bash
   # Should work in both environments without rebuilds
   yarn test tests/core/database.test.ts
   ```

## Additional Considerations

- **Git ignore patterns**: Update `.gitignore` for new paths
- **CI/CD impacts**: Ensure build pipelines handle environment-specific paths
- **Team onboarding**: Document environment setup for new developers
- **Performance**: Monitor impact of separate caches on install times

---

_Last updated: December 2024_
_Related: DevContainer setup, Yarn Berry PnP, better-sqlite3 native modules_
