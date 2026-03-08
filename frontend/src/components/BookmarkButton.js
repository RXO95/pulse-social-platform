import React from 'react';
import styled from 'styled-components';
import { useTheme, getTheme } from '../context/ThemeContext';

const ACTIVE_COLOR = '#1d9bf0';

const BookmarkButton = ({ isBookmarked, onToggle }) => {
  const { darkMode, background } = useTheme();
  const t = getTheme(darkMode, background);
  const defaultColor = t.textSecondary || '#71767b';

  return (
    <StyledWrapper $defaultColor={defaultColor} $active={isBookmarked}>
      <div className="action-row" onClick={onToggle}>
        <div title={isBookmarked ? "Remove bookmark" : "Bookmark"} className={`bookmark-container${isBookmarked ? ' active' : ''}`}>
          <div className="svg-container">
            {isBookmarked ? (
              <svg viewBox="0 0 24 24" width="20" height="20" className="bookmark-icon">
                <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z"></path>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" className="bookmark-icon">
                <path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"></path>
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
  }

  .bookmark-container {
    position: relative;
    width: 35px;
    height: 35px;
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

  .bookmark-container .bookmark-icon {
    fill: ${p => p.$defaultColor};
    transition: all 0.2s ease;
  }

  .bookmark-container:hover .bookmark-icon {
    fill: ${ACTIVE_COLOR};
  }

  .bookmark-container.active .bookmark-icon {
    fill: ${ACTIVE_COLOR};
  }

  .action-row:active .bookmark-container {
    transform: scale(0.92);
  }
`;

export default BookmarkButton;
