FROM node:20

ARG TZ
ENV TZ="$TZ"

# Install basic development tools and iptables/ipset
RUN apt update && apt install -y \
  # Essential editors
  vim \
  nano \
  # Essential system tools
  less \
  htop \
  tree \
  file \
  rsync \
  # Development tools
  git \
  procps \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  gh \
  build-essential \
  # Network tools
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  netcat-openbsd \
  telnet \
  # Data processing
  aggregate \
  jq \
  yq \
  # Download tools
  curl \
  wget

# Install Python 3.11 and uv
RUN apt install -y python3.11 python3.11-dev python3.11-venv python3-pip
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.cargo/bin:$PATH"

# Ensure default node user has access to /usr/local/share
RUN mkdir -p /usr/local/share/npm-global && \
  chown -R node:node /usr/local/share

ARG USERNAME=node

# Install uv for the node user as well
USER node
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/home/node/.cargo/bin:$PATH"
USER root

# Persist bash history.
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

# Set `DEVCONTAINER` environment variable to help with orientation
ENV DEVCONTAINER=true

# Create workspace and config directories and set permissions
RUN mkdir -p /workspace /home/node/.claude && \
  chown -R node:node /workspace /home/node/.claude

RUN npm install -g @anthropic-ai/claude-code

WORKDIR /workspace

RUN ARCH=$(dpkg --print-architecture) && \
  wget "https://github.com/dandavison/delta/releases/download/0.18.2/git-delta_0.18.2_${ARCH}.deb" && \
  sudo dpkg -i "git-delta_0.18.2_${ARCH}.deb" && \
  rm "git-delta_0.18.2_${ARCH}.deb"

# Configure passwordless sudo for node user
# this will later be removed by the firewall script at runtime.
RUN echo "node ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

# Enable corepack for Yarn Berry support (needs root permissions)
# Set COREPACK_ENABLE_DOWNLOAD_PROMPT=0 to avoid interactive prompts
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Set up non-root user
USER node

# Install global packages
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

# Set the default shell to zsh rather than sh
ENV SHELL=/bin/zsh

# Copy Python environment script
COPY pyvenv.sh /home/node/pyvenv.sh
USER root
RUN chown node:node /home/node/pyvenv.sh
USER node

# Source the Python environment script and auto-activate in shell RC files
RUN echo "source /home/node/pyvenv.sh" >> /home/node/.bashrc
RUN echo "pyvenv 2>/dev/null || true" >> /home/node/.bashrc
RUN echo "alias claude-yolo='claude --dangerously-skip-permissions'" >> /home/node/.bashrc
RUN echo "source /home/node/pyvenv.sh" >> /home/node/.zshrc
RUN echo "pyvenv 2>/dev/null || true" >> /home/node/.zshrc
RUN echo "alias claude-yolo='claude --dangerously-skip-permissions'" >> /home/node/.zshrc

# Set up a proper zsh prompt
RUN echo 'PROMPT="%F{green}%n@claude-container%f:%F{blue}%~%f$ "' >> /home/node/.zshrc
RUN echo 'setopt PROMPT_SUBST' >> /home/node/.zshrc

# localdocker alias will be added dynamically in init script

# Copy setup scripts
COPY init-firewall.sh /usr/local/bin/init-firewall.sh
COPY correct-volume-permissions.sh /usr/local/bin/correct-volume-permissions.sh
COPY remove-sudo.sh /usr/local/bin/remove-sudo.sh
COPY setup-python.sh /usr/local/bin/setup-python.sh
USER root
RUN chmod +x /usr/local/bin/init-firewall.sh && \
    chmod +x /usr/local/bin/correct-volume-permissions.sh && \
    chmod +x /usr/local/bin/remove-sudo.sh && \
    chmod +x /usr/local/bin/setup-python.sh
USER node
