import React from 'react';
import styled from 'styled-components';
import { useTheme, getTheme } from '../context/ThemeContext';

const HOVER_COLOR = '#1d9bf0';

const CommentButton = ({ onClick, count = 0 }) => {
  const { darkMode, background } = useTheme();
  const t = getTheme(darkMode, background);
  const defaultColor = t.textSecondary || '#71767b';

  return (
    <StyledWrapper $defaultColor={defaultColor}>
      <div className="action-row" onClick={onClick}>
        <div title="Comment" className="comment-container">
          <div className="svg-container">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="comment-icon">
              <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"></path>
            </svg>
          </div>
        </div>
        <span className="comment-count">{count}</span>
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .action-row {
    display: flex;
    align-items: center;
    gap: 2px;
    cursor: pointer;
  }

  .comment-count {
    font-size: 13px;
    font-weight: 500;
    color: ${p => p.$defaultColor};
    transition: color 0.2s;
    min-width: 8px;
  }

  .comment-container {
    position: relative;
    width: 35px;
    height: 35px;
    transition: .2s;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 50%;
  }

  .comment-container:hover {
    background-color: rgba(29, 155, 240, 0.1);
  }

  .comment-container .svg-container {
    width: 100%; 
    height: 100%;
    display: flex; 
    justify-content: center; 
    align-items: center;
  }

  .comment-container .comment-icon {
    fill: ${p => p.$defaultColor};
    transition: all 0.2s ease;
  }

  .action-row:hover .comment-icon {
    fill: ${HOVER_COLOR};
  }

  .action-row:hover .comment-count {
    color: ${HOVER_COLOR};
  }

  .action-row:active .comment-container {
    transform: scale(0.92);
  }
`;

export default CommentButton;