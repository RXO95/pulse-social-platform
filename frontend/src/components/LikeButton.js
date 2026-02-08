import React from 'react';
import styled from 'styled-components';

const LikeButton = ({ isLiked, onLike, count }) => {
  return (
    <StyledWrapper>
      <div className="action-row">
        <div title="Like" className="heart-container">
          <input 
            className="checkbox" 
            type="checkbox" 
            checked={isLiked} 
            onChange={onLike}
          />
          <div className="svg-container">
            <svg xmlns="http://www.w3.org/2000/svg" className="svg-outline" viewBox="0 0 24 24">
              <path d="M17.5,1.917a6.4,6.4,0,0,0-5.5,3.3,6.4,6.4,0,0,0-5.5-3.3A6.8,6.8,0,0,0,0,8.967c0,4.547,4.786,9.513,8.8,12.88a4.974,4.974,0,0,0,6.4,0C19.214,18.48,24,13.514,24,8.967A6.8,6.8,0,0,0,17.5,1.917Zm-3.585,18.4a2.973,2.973,0,0,1-3.83,0C4.947,16.006,2,11.87,2,8.967a4.8,4.8,0,0,1,4.5-5.05A4.8,4.8,0,0,1,11,8.967a1,1,0,0,0,2,0,4.8,4.8,0,0,1,4.5-5.05A4.8,4.8,0,0,1,22,8.967C22,11.87,19.053,16.006,13.915,20.313Z"></path>
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" className="svg-filled" viewBox="0 0 24 24">
              <path d="M17.5,1.917a6.4,6.4,0,0,0-5.5,3.3,6.4,6.4,0,0,0-5.5-3.3A6.8,6.8,0,0,0,0,8.967c0,4.547,4.786,9.513,8.8,12.88a4.974,4.974,0,0,0,6.4,0C19.214,18.48,24,13.514,24,8.967A6.8,6.8,0,0,0,17.5,1.917Z"></path>
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" height={100} width={100} className="svg-celebrate">
              <polygon points="10,10 20,20" /><polygon points="10,50 20,50" /><polygon points="20,80 30,70" /><polygon points="90,10 80,20" /><polygon points="90,50 80,50" /><polygon points="80,80 70,70" />
            </svg>
          </div>
        </div>
        <span className="like-count">{count}</span>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .action-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .like-count {
    font-size: 14px;
    font-weight: 600;
    color: #65676b;
  }

  .heart-container {
    --heart-color: #f91880; /* Twitter Pink */
    position: relative;
    width: 40px;
    height: 40px;
    transition: .3s;
  }

  .heart-container .checkbox {
    position: absolute;
    width: 100%; height: 100%;
    opacity: 0; z-index: 20;
    cursor: pointer;
  }

  .heart-container .svg-container {
    width: 100%; height: 100%;
    display: flex; justify-content: center; align-items: center;
  }

  .heart-container .svg-outline, .heart-container .svg-filled {
    fill: var(--heart-color);
    position: absolute;
    width: 24px;
  }

  .heart-container .svg-filled {
    display: none;
    animation: keyframes-svg-filled 1s;
  }

  .heart-container .svg-celebrate {
    position: absolute;
    animation: keyframes-svg-celebrate .5s;
    animation-fill-mode: forwards;
    display: none;
    stroke: var(--heart-color);
    fill: var(--heart-color);
    stroke-width: 2px;
  }

  .heart-container .checkbox:checked~.svg-container .svg-filled { display: block; }
  .heart-container .checkbox:checked~.svg-container .svg-celebrate { display: block; }

  @keyframes keyframes-svg-filled {
    0% { transform: scale(0); }
    25% { transform: scale(1.2); }
    50% { transform: scale(1); filter: brightness(1.5); }
  }

  @keyframes keyframes-svg-celebrate {
    0% { transform: scale(0); }
    50% { opacity: 1; filter: brightness(1.5); }
    100% { transform: scale(1.4); opacity: 0; }
  }
`;

export default LikeButton;