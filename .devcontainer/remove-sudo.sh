#!/bin/bash

# Secure system scripts and remove sudo privileges
echo "Securing system configuration files..."

# Make all devcontainer scripts immutable to prevent self-escalation
echo "Locking devcontainer scripts..."
chown root:root /usr/local/bin/init-firewall.sh
chown root:root /usr/local/bin/correct-volume-permissions.sh
chown root:root /usr/local/bin/remove-sudo.sh
chown root:root /usr/local/bin/setup-python.sh
chmod 755 /usr/local/bin/init-firewall.sh
chmod 755 /usr/local/bin/correct-volume-permissions.sh
chmod 755 /usr/local/bin/remove-sudo.sh
chmod 755 /usr/local/bin/setup-python.sh

# Make the .devcontainer directory readonly for node user
echo "Securing .devcontainer directory..."
if [ -d "/workspace/.devcontainer" ]; then
    chown -R root:root /workspace/.devcontainer
    chmod -R 644 /workspace/.devcontainer/*
    chmod 755 /workspace/.devcontainer
    # Make scripts executable but not writable
    find /workspace/.devcontainer -name "*.sh" -exec chmod 755 {} \;
fi

# Protect critical system files
echo "Protecting system configuration..."
chown root:root /etc/sudoers
chmod 440 /etc/sudoers
chown root:root /etc/hosts
chmod 644 /etc/hosts

# Remove sudo privileges from node user to prevent privilege escalation
echo "Removing sudo privileges from node user..."
sed -i '/^node ALL=(ALL) NOPASSWD: ALL$/d' /etc/sudoers
echo "Security lockdown complete. Node user cannot modify system configuration."