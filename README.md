# 👑 Crownfall: A War of Digits

> An original tactical strategy board game blending the geometric spatial movement of **Chess & Shogi** with the digit-placement depth and province control of **Sudoku**.

![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)
![React](https://img.shields.io/badge/React-18-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-cyan.svg)
![Vite](https://img.shields.io/badge/Vite-6-purple.svg)

---

## ⚔️ The Concept

In **Crownfall**, two rival warlords command a warband composed of the numbers **1 through 9**. The board is a standard $9 \times 9$ battlefield divided into nine $3 \times 3$ provinces.

Every digit possesses unique movement patterns, strike rules, and tactical constraints inspired by Sudoku:
- **Digit 9 is the Crown (The King)**: If your Crown falls or is pinned with no escape, you suffer **Regicide** and lose the war.
- **Digits 1–8 are Tactical Units**: Ranging from flexible vanguard pawns to agile skirmishers and high-impact defenders.
- **Province Control & Dominance**: Lock down rows, columns, and $3 \times 3$ subgrids to achieve victory through territorial dominance.

---

## 🎮 Key Features

- **Responsive War Engine**: Engineered for optimal play across mobile smartphones, tablets, and high-resolution desktop screens.
- **Dynamic 9-Chip Warband Tray**: Clean, thumb-friendly unit deployment with dedicated indicators for the royal Crown #9.
- **4-Chapter Campaign Marches**: Narrative single-player challenges introducing progressive tactical complexities and AI behaviors.
- **Field Manual**: An in-game comprehensive codex detailing piece movements, province clash rules, and tactical doctrines.
- **Canvas-Accelerated Rendering**: High-performance grid rendering with sub-pixel alignment and smooth visual feedback.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` or `yarn` / `pnpm`

### Installation

```bash
# Clone the repository
git clone https://github.com/codewithabhiishek/Crownfall-A-War-of-Digits.git

# Navigate into the project directory
cd Crownfall-A-War-of-Digits

# Install dependencies
npm install

# Start the local development server
npm run dev
```

The game will launch locally (typically at `http://localhost:3003`).

### Production Build

```bash
# Check TypeScript types
npm run typecheck

# Build optimized production bundle
npm run build
```

---

## 📱 Responsive Layout & Controls

- **Mobile (< 768px)**: Tabbed campaign/brief switcher, compact enemy readout, and full-width non-scrolling 9-chip Warband deployment tray.
- **Tablet & Desktop (≥ 768px)**: Dual-pane strategic dashboard with persistent field manual access, move history, and audio-visual cues.

---

## 🛠️ Tech Stack

- **Framework**: [React 18](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/) & HTML5 Canvas

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
