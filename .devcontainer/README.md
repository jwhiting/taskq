# Claude Code Containerized Development Environment

A secure, isolated development container for running Claude Code with network restrictions and automatic dependency management.

## Overview

This devcontainer provides a sandboxed environment for Claude Code development with:
- **Network isolation via firewall** with domain whitelisting
- **Automatic Python environment setup** using uv (optional)
- **Isolated node_modules from host**
- **Local git access** from within containers
- **Essential Linux development tools** (vim, htop, tree, etc.)
- **Shared claude code settings with host ~/.claude dir**

## Quick Start

### Prerequisites

- Docker desktop
- devcontainer CLI
- for accesing other docker images, like NocoDB for microheap import/export, you need a host alias to bridge them. This is done by running the `setup-localdocker-host.sh` script in the .devcontainer directory which installs an alias for "localdocker" to localhost on your host, then in containers that alias points to the docker gateway IP.

### Steps

1. **Start the container:**
   ```bash
   ./claude-container up
   ```

2. **Open a shell:**
   ```bash
   ./claude-container shell
   ```

3. **Run Claude Code:**
   ```bash
   # this is an alias for the cumbersome `claude --dangerously-skip-permissions`
   claude-yolo
   ```

Claude code can:
- create, read, write, and delete files in the git repo folder
- make network requests to the whitelisted domains
- and also has full r/w on your `~/.claude` folder (i hate that, but it's a conventient start. claude code needs r/w access there for things like auth, but also keeps sensitive session history and other leaky info across contexts this way)

4. **Stop the container:**
   ```bash
   ./claude-container stop
   ```

## Design Approach

### Security-First Architecture
- **Read-only mounts** for configuration files to prevent tampering
- **Network isolation** via iptables with ipset allowlisting
- **Privilege escalation prevention** through sudo removal after firewall setup
- **Container-specific dependency isolation** to prevent cross-project contamination (note: ~/.claude dir history/project data is a cross-project data leak currently.)

### Monorepo Git Integration
- Mounts the entire git repository root for full git functionality
- Working directory set to the specific subproject
- Enables local commits, branching, and git history access
- No remote push capabilities (by design, pushing to github won't work due to lack of auth/ssh keys, which is good, we don't want a rogue agent messing with github.)

### Automatic Environment Management
- Python virtual environments automatically created and activated (see PYPROJECT_TOML env var in devcontainer config)
- UV uses container-specific `.venv-container` directories to avoid host conflicts, because these python venvs are dependent on the original path (and maybe platform too), which changes in the container.

## Usage

### Available Commands
- `claude` - Standard Claude Code execution
- `claude-yolo` - Claude Code with `--dangerously-skip-permissions`
- `pyvenv` - Manually setup/activate Python environment (called automatically in bashrc)
- Standard Linux tools: `vim`, `nano`, `htop`, `tree`, `jq`, `yq`, etc.

### Network Access
The container allows access to:
- Python package indexes (PyPI, etc.)
- NPM and yarn repos
- Standard development domains
- **Host services** via the `localdocker` hostname

Additional domains can be added via the `ALLOWED_DOMAINS` environment variable in the devcontainer.json.

#### Container-Host Communication
A special `localdocker` hostname is configured for seamless communication between the container and host services:

**Setup (run once on host):**
```bash
./setup-localdocker-host.sh
```

**Usage from anywhere:**
```bash
# Access host services (like NocoDB on port 8080)
curl http://localdocker:8080

# Use in application configs
DATABASE_URL=http://localdocker:8080
```

**How it works:**
- **Host macOS**: `localdocker` → `127.0.0.1` (localhost)
- **Container**: `localdocker` → `192.168.65.254` (Docker gateway)
- **Result**: Same hostname works in both environments, so .env files can be shared between host and container. (Since containers use shared filesystem mount strategy, there's no other way.)

### File Structure
```
/workspace/              # Git repository root
├── .git/                # Full git access
├── .devcontainer/       # Container configuration (readonly)
├── .venv/               # Container-isolated Python venv (volume)
├── uv.lock              # Shared lock file (⚠️ potential conflicts)
├── pyproject.toml       # Python dependencies if applicable (shared)
├── yarn.lock            # Shared lock file (⚠️ potential conflicts)
├── package.json         # Typescript dependencies if (shared)
└── ...
```

**Volume Isolation**:
- `.venv/` is container-specific via volume overlay, host has its own isolated version
- using yarn 2+, eliminates `node_modules` issues
- `uv.lock` is shared and may have cross-platform conflicts
- `yarn.lock` is shared and may have cross-platform conflicts
- All other files are shared between host and container

## Configuration

### Environment Variables
Configured in the .devcontainer/devcontainer.json file:
- `ALLOWED_DOMAINS` - Comma-separated list of allowed domains
- `PYPROJECT_TOML` - Path to Python project configuration (see the setup-python.sh script for more info)

---

## Gory Details & Known Issues

### Mount Point Architecture
**Problem**: DevContainers require explicit mount declarations, but Claude Code doesn't separate configuration from session data.

**Current Solution**: Direct mount of entire `~/.claude` directory.
- ⚠️ **SECURITY RISK**: Session history and project data from other projects is accessible
- ✅ **BENEFIT**: Zero-configuration Claude Code authentication
- 🔮 **Future**: Implement selective file sync or cleaned config directory

### Virtual Environment Conflicts
**Problem**: Host and container share the same `.venv` and/or `node_modules` directory, causing binary compatibility issues (macOS host vs Ubuntu container).

**Solution**: Container-isolated virtual environments via volume overlays, use yarn 2+ for node modules.
- ✅ **IMPLEMENTATION**: Volume mount overlays directory in container (works for .venv, n/a for yarn berry deps)
- ✅ **BENEFIT**: Complete isolation - no binary compatibility conflicts
- ✅ **BENEFIT**: Standard naming conventions maintained

### Lock File Cross-Platform Issues (UNRESOLVED)
**Problem**: `uv.lock` and `yarn.lock` files contain platform-specific package metadata (wheel hashes, platform dependencies) causing conflicts when shared between macOS host and Linux container.

**Current Status**: 
- ❌ **NO TECHNICAL SOLUTION**: Docker doesn't support file-level isolation elegantly
- 📝 **MANUAL WORKAROUND**: Be careful not to commit lock file changes from container
- 🤔 **RECOMMENDATION**: Perform all `uv` `yarn` dependency management operations on the host macOS environment
- ⚠️ **KNOWN ISSUE**: Running installation/sync in the container may update lock file with Linux-specific hashes

**Why we couldn't solve this**:
- Docker volumes are directories, not files
- File-level overlay mounts require complex symlink schemes
- Solutions became more complex than the problem they solved

### Firewall Implementation Details
**Problem**: iptables rules require runtime kernel access, not available during Docker build.

**Solution**: Runtime firewall setup via postCreateCommand.
- ✅ **IMPLEMENTATION**: `init-firewall.sh` runs after container creation
- ✅ **FEATURE**: Domain-to-IP resolution with ipset management
- ✅ **SECURITY**: Sudo removal after firewall configuration
- ⚠️ **LIMITATION**: Requires NET_ADMIN/NET_RAW capabilities

### Container-Host Communication (localdocker hostname hack)
**Problem**: Applications need to connect to services running on the host (like databases), but hostnames differ between host and container environments.

**Solution**: Unified `localdocker` hostname with environment-specific IP resolution.

**Implementation**:
- ✅ **Host Setup**: `setup-localdocker-host.sh` adds `127.0.0.1 localdocker` to `/etc/hosts`
- ✅ **Container Setup**: Firewall script dynamically adds `<host-gateway-ip> localdocker` to container's `/etc/hosts`
- ✅ **Firewall Integration**: Host gateway IP automatically added to firewall allowlist
- 📝 **Limitation**: Requires one-time host setup script execution

**Benefits**:
- No environment-specific configuration needed
- Application code uses same hostname everywhere
- Automatic Docker Desktop host gateway detection

**Security Note**: Container can reach host services via this hostname - this is intentional for development but should be considered in security reviews.

