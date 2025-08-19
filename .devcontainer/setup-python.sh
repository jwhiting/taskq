#!/bin/bash

# Standalone Python environment setup script for postCreateCommand
if [ -n "${PYPROJECT_TOML:-}" ] && [ -f "${PYPROJECT_TOML}" ]; then
    echo "Setting up Python environment for project: ${PYPROJECT_TOML}"
    project_dir=$(dirname "${PYPROJECT_TOML}")
    cd "${project_dir}"
    
    # Create virtual environment in standard location
    echo "Creating virtual environment: .venv"
    uv venv .venv
    
    # Activate the environment first
    echo "Activating virtual environment..."
    source .venv/bin/activate
    
    # Now sync dependencies to the active environment
    echo "Syncing dependencies..."
    UV_LINK_MODE=copy uv sync --active
    
    echo "Python environment setup complete!"
    echo "Use 'pyvenv' command to activate this environment in your shell."
else
    echo "No Python project configured. Set PYPROJECT_TOML environment variable."
fi