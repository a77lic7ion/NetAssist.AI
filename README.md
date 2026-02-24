# NetVal - Network Staging Intelligence Platform

NetVal is a local-first, AI-powered network staging and validation platform designed for network engineers. It allows users to design network topologies, manage device configurations, and validate network logic using various AI models (Ollama, Gemini, OpenAI, etc.).

## 🚀 Key Features

*   **Project Management**: Organize network designs into projects.
*   **Interactive Topology Canvas**: Visually design networks by adding nodes (routers, switches, firewalls) and links.
*   **Device Configuration Management**:
    *   Upload and store device configurations (running-config).
    *   Edit configurations with syntax highlighting.
    *   Parse configurations using `ciscoconfparse` and `textfsm`.
*   **AI-Powered Analysis**:
    *   Chat with your network context using LLMs.
    *   Validate configurations against design rules.
    *   Generate suggestions for optimization and security.
*   **Local-First Architecture**:
    *   Runs locally on your machine.
    *   Supports local LLMs via Ollama for privacy and offline capability.
    *   Data is stored in a local SQLite database.

## 🛠️ Tech Stack

*   **Backend**: Python (FastAPI, SQLAlchemy, NetworkX, Netmiko/Paramiko)
*   **Frontend**: React (Vite, TypeScript, Tailwind CSS, React Flow, Zustand)
*   **Database**: SQLite (via aiosqlite)
*   **AI Integration**: OpenAI SDK compatible bridge (supports Ollama, Gemini, etc.)

## 📦 Installation & Running

### Prerequisites
*   **Python 3.11+**
*   **Node.js 20+**
*   *(Optional)* **Ollama** installed and running for local AI support.

### Quick Start (Windows)
Simply run the `run.bat` script in the root directory.

```powershell
.\run.bat
```

This script will:
1.  Request Administrator privileges (required for process management).
2.  Kill any stale background processes (python, node, uvicorn).
3.  Set up the Python virtual environment and install dependencies.
4.  Install Node.js dependencies.
5.  Launch the Backend (Port 8742) and Frontend (Port 5173).
6.  Automatically open your default web browser.

## 📝 Usage Guide

1.  **Create a Project**: Start by creating a new project in the sidebar.
2.  **Build Topology**: (Coming Soon) Add devices to the canvas and connect them.
3.  **Manage Configs**: (Coming Soon) Select a device to upload or paste its configuration.
4.  **AI Assistant**: (Coming Soon) Use the AI chat to analyze the selected project or device.

## 🤝 Contributing
This is an active development project. Contributions are welcome!
