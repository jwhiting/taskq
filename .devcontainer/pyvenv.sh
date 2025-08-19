#!/bin/bash

# Python project environment function
pyvenv() {
    if [ -n "${PYPROJECT_TOML:-}" ] && [ -f "${PYPROJECT_TOML}" ]; then
        echo "Setting up Python environment for project: ${PYPROJECT_TOML}"
        local project_dir=$(dirname "${PYPROJECT_TOML}")
        cd "${project_dir}"
        
        # Create virtual environment if it doesn't exist or is incomplete
        if [ ! -f ".venv/bin/activate" ]; then
            echo "Creating virtual environment: .venv"
            uv venv .venv
        else
            echo "Virtual environment already exists: .venv"
        fi
        
        # Activate the environment
        echo "Activating virtual environment..."
        source .venv/bin/activate
        
        # Now sync dependencies to the active environment
        echo "Syncing dependencies..."
        UV_LINK_MODE=copy uv sync --active
        
        echo "Python environment activated! You can now use 'python' directly."
    else
        echo "No Python project configured. Set PYPROJECT_TOML environment variable."
    fi
}