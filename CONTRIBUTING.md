# Contributing to Vet

First of all, thank you for taking the time to contribute! Contributions from the community help make Vet a better tool for everyone.

To maintain code quality and ensure a smooth review process, please review and follow these guidelines.

---

## 📋 Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How Can I Contribute?](#how-can-i-contribute)
   * [Reporting Bugs](#reporting-bugs)
   * [Suggesting Enhancements](#suggesting-enhancements)
   * [Pull Requests](#pull-requests)
3. [Development Workflow](#development-workflow)
   * [Prerequisites](#prerequisites)
   * [Installation](#installation)
   * [Local Development](#local-development)
   * [Testing & Linting](#testing--linting)
4. [Style Guides](#style-guides)

---

## 🤝 Code of Conduct

By participating in this project, you agree to uphold our Code of Conduct. Please be respectful and professional in all interactions.

---

## 💡 How Can I Contribute?

### Reporting Bugs

If you find a bug, please open an Issue on GitHub. Before submitting, search existing issues to see if the bug has already been reported.

When filing an issue, please include:
* **Operating System**: (e.g. Ubuntu 22.04, macOS Sonoma, Windows 11)
* **Node.js & NPM versions**: (run `node -v` and `npm -v`)
* **Steps to Reproduce**: Detailed steps to reproduce the issue.
* **Expected vs. Actual Behavior**: What you expected to happen vs. what actually happened.
* **Screenshots/Logs**: Any relevant visual assets or terminal output logs.

### Suggesting Enhancements

We welcome feature requests! Please open an Issue and select the feature request template.
* Explain the **core problem** you want to solve.
* Describe the **proposed solution** or UI design.
* List any **alternatives** you have considered.

### Pull Requests

Please follow these steps to submit your changes:

1. **Fork** the repository and create your branch from `dev`:
   ```bash
   git checkout -b feature/amazing-feature
   ```
   *For bug fixes, use:* `bugfix/fix-issue-name`
2. **Implement** your changes. Add unit tests if applicable.
3. **Validate** your code by running formatting, linting, and tests (see below).
4. **Commit** your changes with clear, descriptive commit messages conforming to Conventional Commits (e.g., `feat: add glassmorphic sidebar`, `fix: resolve sftp timeout`).
5. **Push** to your fork and submit a Pull Request (PR) targeting the `dev` branch.

---

## ⚙️ Development Workflow

### Prerequisites
* **Node.js** (v18 or higher)
* **npm** (v9 or higher)

### Installation
Clone the repository and install all development dependencies:
```bash
git clone https://github.com/dawiisss/vet.git
cd vet
npm install
```

### Local Development
To launch the application in development mode with live reloading and hot module replacement (HMR) enabled:
```bash
npm run dev
```

### Testing & Linting
Before submitting a pull request, ensure all validation scripts pass:

* **Static Type Checking**:
  ```bash
  npm run typecheck
  ```
* **Linter**:
  ```bash
  npm run lint
  ```
* **Test Suite**:
  ```bash
  npm run test
  ```
* **Test Coverage**:
  ```bash
  npm run test:coverage
  ```

---

## 🎨 Style Guides

* **TypeScript**: Use strict typing where possible. Avoid the `any` type.
* **React Components**: Prefer functional components with hooks. Use modular CSS or standard Tailwind classes.
* **State Management**: Use Zustand stores responsibly, keeping state minimal and selectors optimized.
* **Code Formatting**: Code formatting is enforced via ESLint. Please run `npm run lint` and fix any warnings or errors.
