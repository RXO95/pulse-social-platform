import styled from "styled-components";

/* ═══════════════════════════════════════════════════════════
   MatrixBackground — animated Indian script grid
   Hindi (Devanagari), Marathi, Bangla, Kannada characters
   Darker version so UI content remains readable
   ═══════════════════════════════════════════════════════════ */

// Hindi / Marathi (Devanagari)
const DEVANAGARI = "अआइईउऊएऐओऔकखगघचछजझटठडढणतथदधनपफबभमयरलवशषसह";
// Bangla
const BANGLA = "অআইঈউঊএঐওঔকখগঘচছজঝটঠডঢণতথদধনপফবভমযরলশষসহ";
// Kannada
const KANNADA = "ಅಆಇಈಉಊಎಏಐಒಓಔಕಖಗಘಚಛಜಝಟಠಡಢಣತಥದಧನಪಫಬಭಮಯರಲವಶಷಸಹ";

const ALL_CHARS = DEVANAGARI + BANGLA + KANNADA;

// Generate ~600 characters from the mixed pool for the grid
const chars = Array.from({ length: 600 }, (_, i) => ALL_CHARS[i % ALL_CHARS.length]);

export default function MatrixBackground() {
  return (
    <Wrapper>
      <div className="indic-matrix">
        {chars.map((ch, i) => (
          <span key={i}>{ch}</span>
        ))}
      </div>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;

  .indic-matrix {
    background-color: #020206;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(42px, 1fr));
    grid-auto-rows: 42px;
    font-size: 28px;
    /* much dimmer base colour so UI is readable */
    color: rgba(0, 120, 220, 0.18);
    font-family: "Noto Sans Devanagari", "Noto Sans Bengali", "Noto Sans Kannada", sans-serif;
    justify-content: center;
    align-content: center;
  }

  .indic-matrix > span {
    text-align: center;
    text-shadow: 0 0 4px rgba(0, 120, 220, 0.2);
    user-select: none;
    transition: color 0.5s, text-shadow 0.5s;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* staggered pulse animations — different nth-child intervals */
  .indic-matrix > span:nth-child(19n + 2) {
    animation: indic-pulse 3.5s ease-in-out infinite 0.2s;
  }
  .indic-matrix > span:nth-child(29n + 1) {
    animation: indic-pulse 4.1s ease-in-out infinite 0.7s;
  }
  .indic-matrix > span:nth-child(11n) {
    color: rgba(80, 170, 240, 0.3);
    animation: indic-pulse 2.9s ease-in-out infinite 1.1s;
  }
  .indic-matrix > span:nth-child(37n + 10) {
    animation: indic-pulse 5.3s ease-in-out infinite 1.5s;
  }
  .indic-matrix > span:nth-child(41n + 1) {
    animation: indic-pulse 3.9s ease-in-out infinite 0.4s;
  }
  .indic-matrix > span:nth-child(17n + 9) {
    animation: indic-pulse 2.8s ease-in-out infinite 0.9s;
  }
  .indic-matrix > span:nth-child(23n + 18) {
    animation: indic-pulse 4.3s ease-in-out infinite 1.3s;
  }
  .indic-matrix > span:nth-child(31n + 4) {
    animation: indic-pulse 5.6s ease-in-out infinite 0.1s;
  }
  .indic-matrix > span:nth-child(43n + 20) {
    animation: indic-pulse 3.6s ease-in-out infinite 1.8s;
  }
  .indic-matrix > span:nth-child(13n + 6) {
    animation: indic-pulse 3.2s ease-in-out infinite 1.2s;
  }
  .indic-matrix > span:nth-child(53n + 5) {
    animation: indic-pulse 4.9s ease-in-out infinite 0.5s;
  }
  .indic-matrix > span:nth-child(47n + 15) {
    animation: indic-pulse 5.9s ease-in-out infinite 1s;
  }

  @keyframes indic-pulse {
    0%, 100% {
      color: rgba(0, 120, 220, 0.18);
      text-shadow: 0 0 4px rgba(0, 120, 220, 0.2);
    }
    30% {
      color: rgba(80, 180, 255, 0.55);
      text-shadow: 0 0 8px rgba(80, 180, 255, 0.5), 0 0 12px rgba(80, 180, 255, 0.3);
    }
    50% {
      color: rgba(200, 80, 160, 0.5);
      text-shadow: 0 0 8px rgba(200, 80, 160, 0.4), 0 0 12px rgba(200, 80, 160, 0.2);
    }
    70% {
      color: rgba(255, 255, 255, 0.45);
      text-shadow: 0 0 6px rgba(255, 255, 255, 0.3), 0 0 10px rgba(255, 255, 255, 0.15);
    }
  }
`;
