import React from 'react';
import styled from 'styled-components';

const BookmarkButton = ({ isBookmarked, onToggle }) => {
  return (
    <StyledWrapper>
      <div className="action-row" onClick={onToggle}>
        <div title={isBookmarked ? "Remove bookmark" : "Bookmark"} className="bookmark-container">
          <div className="svg-container">
            {isBookmarked ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="svg-filled" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.536A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1z"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="svg-outline" viewBox="0 0 24 24" fill="none">
                <path 
                  d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.536A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1zm13 2H6v15.432l6-3.761 6 3.761V4z" 
                  fill="currentColor"
                />
              </svg>
            )}
          </div>
        </div>
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .action-row {
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-row:hover {
    transform: translateY(-1px);
  }

  .bookmark-container {
    --bookmark-color: #1d9bf0;
    position: relative;
    width: 40px;
    height: 40px;
    transition: .2s;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 50%;
  }

  .bookmark-container:hover {
    background-color: rgba(29, 155, 240, 0.1);
  }

  .bookmark-container .svg-container {
    width: 100%; 
    height: 100%;
    display: flex; 
    justify-content: center; 
    align-items: center;
  }

  .bookmark-container .svg-outline,
  .bookmark-container .svg-filled {
    color: var(--bookmark-color);
    width: 20px;
    height: 20px;
    transition: all 0.2s ease;
  }

  .bookmark-container .svg-filled {
    color: var(--bookmark-color);
  }

  .bookmark-container:hover .svg-outline,
  .bookmark-container:hover .svg-filled {
    transform: scale(1.1);
  }
`;

export default BookmarkButton;
