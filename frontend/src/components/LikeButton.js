import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { useTheme, getTheme } from '../context/ThemeContext';

const LIKED_COLOR = '#f91880';

const LikeButton = ({ isLiked, onLike, count }) => {
  const [justClicked, setJustClicked] = useState(false);
  const timerRef = useRef(null);
  const { darkMode, background } = useTheme();
  const t = getTheme(darkMode, background);
  const defaultColor = t.textSecondary || '#71767b';

  const handleClick = () => {
    if (!isLiked) {
      setJustClicked(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setJustClicked(false), 1000);
    }
    onLike();
  };

  return (
    <StyledWrapper $defaultColor={defaultColor}>
      <div className="action-row">
        <div title="Like" className={`heart-container${isLiked ? ' liked' : ''}${justClicked ? ' animate' : ''}`} onClick={handleClick}>
          <div className="svg-container">
            {isLiked ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="svg-filled" viewBox="0 0 24 24">
                  <path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.45-4.92-.334-6.98C3.907 4.19 6.043 3 8.399 3c1.837 0 3.238.84 4.1 1.78A5.61 5.61 0 0 1 16.6 3c2.358 0 4.494 1.19 5.617 3.21 1.116 2.06 1.026 4.48-.333 6.98z"></path>
                </svg>
                {justClicked && (
                  <svg xmlns="http://www.w3.org/2000/svg" height={100} width={100} className="svg-celebrate">
                    <polygon points="10,10 20,20" /><polygon points="10,50 20,50" /><polygon points="20,80 30,70" /><polygon points="90,10 80,20" /><polygon points="90,50 80,50" /><polygon points="80,80 70,70" />
                  </svg>
                )}
              </>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="svg-outline" viewBox="0 0 24 24">
                <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.56-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.45-4.92-.334-6.98C3.907 4.19 6.043 3 8.399 3c1.837 0 3.238.84 4.1 1.78A5.61 5.61 0 0 1 16.6 3c2.358 0 4.494 1.19 5.617 3.21 1.116 2.06 1.026 4.48-.333 6.98z"></path>
              </svg>
            )}
          </div>
        </div>
        <span className="like-count" style={isLiked ? {color: '#f91880'} : undefined}>{count}</span>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .action-row {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .like-count {
    font-size: 13px;
    font-weight: 500;
    color: ${p => p.$defaultColor};
    transition: color 0.2s;
    min-width: 8px;
  }

  .heart-container.liked ~ .like-count,
  .heart-container.liked + .like-count {
    color: ${LIKED_COLOR};
  }

  .heart-container {
    position: relative;
    width: 35px;
    height: 35px;
    transition: .2s;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 50%;
    cursor: pointer;
  }

  .heart-container:hover {
    background-color: rgba(244, 33, 46, 0.1);
  }

  .heart-container .svg-container {
    width: 100%; height: 100%;
    display: flex; justify-content: center; align-items: center;
  }

  .heart-container .svg-outline, .heart-container .svg-filled {
    position: absolute;
    width: 20px;
    height: 20px;
  }

  .heart-container .svg-outline {
    fill: ${p => p.$defaultColor};
    transition: fill 0.2s;
  }

  .heart-container:hover .svg-outline {
    fill: ${LIKED_COLOR};
  }

  .heart-container.liked .like-count {
    color: ${LIKED_COLOR};
  }

  .heart-container .svg-filled {
    fill: ${LIKED_COLOR};
  }

  .heart-container.animate .svg-filled {
    animation: keyframes-svg-filled 0.35s cubic-bezier(0.12, 1.36, 0.82, 1.12);
  }

  .heart-container .svg-celebrate {
    position: absolute;
    animation: keyframes-svg-celebrate .5s;
    animation-fill-mode: forwards;
    stroke: ${LIKED_COLOR};
    fill: ${LIKED_COLOR};
    stroke-width: 2px;
  }

  @keyframes keyframes-svg-filled {
    0% { transform: scale(0); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }

  @keyframes keyframes-svg-celebrate {
    0% { transform: scale(0); }
    50% { opacity: 1; filter: brightness(1.5); }
    100% { transform: scale(1.4); opacity: 0; }
  }
`;

export default LikeButton;