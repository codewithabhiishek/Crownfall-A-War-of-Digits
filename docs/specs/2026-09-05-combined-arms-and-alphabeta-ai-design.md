# Design Specification: Combined Arms & Multi-Ply Alpha-Beta AI

**Date**: 2026-09-05  
**Project**: Crownfall (Games/Crown-Fall)  
**Status**: Approved / In-Implementation

---

## 1. Overview & Problem Statement

Crownfall's original mechanics suffered from two primary design limitations:
1. **High-Digit Monopoly**: Because a unit could only capture an enemy of equal or lesser value ($attacker \ge target$), high digits like #8 (Warlord) and #7 (Warden) dominated the board once deployed. Low digits (1–3) were reduced to passive fodder, offering little tactical depth.
2. **Predictable & Short-Sighted AI**: The AI only calculated a 1-ply greedy static evaluation with noise. It could not perceive basic 2-turn tactical forks, bait traps, or defensive retreats for its Crown.

To solve both issues and deliver deep, high-stakes tactical gameplay, this specification introduces:
- **Combined Arms (Assisted Assaults)**: Mathematical flanking rules that allow coordinated lower digits to gang up and topple high digits.
- **Multi-Ply Alpha-Beta Minimax AI**: Multi-ply lookahead with search depth scaling from 1 ply (Squire) to 3 plies (Warlord) with alpha-beta pruning and move ordering.

---

## 2. Mechanics Specification: Combined Arms (Assisted Assault)

### 2.1 Core Mathematical Rule
Let $P_A$ be the primary attacking piece of value $V(P_A)$ attempting to move to square $(r_T, c_T)$ occupied by enemy piece $P_T$ of value $V(P_T)$.

1. **Solo Capture Condition**:
   $$V(P_A) \ge V(P_T) \quad \lor \quad V(P_T) = 9$$
   *(Any unit can still slay the Crown solo).*

2. **Assisted Capture Condition**:
   If the solo condition is not met ($V(P_A) < V(P_T)$ and $V(P_T) \ne 9$):
   Let $\mathcal{S}$ be the set of other friendly pieces $P_i$ ($i \ne A$, $P_i.side = P_A.side$) whose movement pattern can also strike square $(r_T, c_T)$.
   $$\text{Highest Supporter Value } V_S = \max_{P_i \in \mathcal{S}} V(P_i) \quad (\text{or } 0 \text{ if } \mathcal{S} = \emptyset)$$
   $$\text{Effective Assault Power } E = V(P_A) + V_S$$
   $$\text{Valid Capture if } E \ge V(P_T)$$

3. **Resolution**:
   - $P_A$ moves to $(r_T, c_T)$ and claims the capture.
   - The assisting piece $P_S$ remains at its station (providing tactical fire support).
   - War score / capture points are awarded to the acting side.

---

## 3. Architecture Specification: Multi-Ply Alpha-Beta Search AI

### 3.1 Search Depth & Configuration
- **Squire**: Depth 1 + Gaussian noise (casual experience).
- **Knight**: Depth 2 Minimax with Alpha-Beta pruning (calculates AI move $\to$ player's strongest counter).
- **Warlord**: Depth 3 Minimax with Alpha-Beta pruning, move ordering (captures and Crown attacks first), and Crown-safety evaluation.

### 3.2 Evaluation Heuristic
For any board state $S$, the evaluation function from AI perspective (Side 1) computes:
$$\text{Eval}(S) = \Delta\text{Material} \times 10 + \Delta\text{CrownSafety} \times 25 + \Delta\text{CenterMobility} \times 2 + \Delta\text{FlankPressure} \times 5$$
- If AI Crown is captured: $-\infty$ ($-100,000$).
- If Player Crown is captured: $+\infty$ ($+100,000$).
- $\Delta\text{CrownSafety}$: Distance of enemy pieces from Crown, plus severe penalties for threatened Crown squares.
- $\Delta\text{FlankPressure}$: Bonus for having multiple pieces targeting enemy pieces (preparing or executing assisted assaults).

---

## 4. Visual & Audio Indicators

- **Canvas Rendering**:
  - Regular capture targets: Crimson/Gold targeting brackets.
  - Assisted capture targets: Dual glowing pulse rings with "+Assist" pip and supporting link.
- **Audio**:
  - Distinct `assistCapture` harmonic sound to reward coordinated teamwork.
- **Field Manual**:
  - Interactive diagram illustrating $3 + 4 = 7$ assisted assault against an enemy Warden.
