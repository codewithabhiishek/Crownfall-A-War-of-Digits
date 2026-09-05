# 👑 Crownfall: A War of Digits

> An original tactical strategy board game blending the geometric spatial movement of **Chess & Shogi** with the digit-placement depth and province control of **Sudoku**.

![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)
![React](https://img.shields.io/badge/React-18-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-cyan.svg)
![Vite](https://img.shields.io/badge/Vite-6-purple.svg)

---

## ⚔️ The Concept

In **Crownfall**, two rival warlords command a warband composed of the numbers **1 through 9**. The board is a tactical $7 \times 7$ battlefield.

Every digit possesses unique movement patterns, strike rules, and tactical constraints inspired by chess and Sudoku:
- **Digit 9 is The Crown**: Guard it with your life. If your Crown falls, you suffer **Crownfall** and lose immediately. Must be deployed by your 5th turn.
- **Digits 1–8 are Tactical Units**: Each has its own distinct march (Footman, Courier, Knight, Duelist, Lancer, Skirmisher, Warden, Warlord). A piece may capture any enemy of equal or lesser value — and ANY piece may slay the Crown (9).
- **The Law of Rows**: Deployment forbids any two pieces of equal digit value sharing a row or column (across either side).
- **The Royal Decree**: If 60 moves elapse without regicide, the battle ends by Royal Decree, decided by total surviving material.

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
