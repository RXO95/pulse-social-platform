import React from 'react';
import styled from 'styled-components';

const CommentButton = ({ onClick, count = 0 }) => {
  return (
    <StyledWrapper>
      <div className="action-row" onClick={onClick}>
        <div title="Comment" className="comment-container">
          <div className="svg-container">
            <svg xmlns="http://www.w3.org/2000/svg" className="svg-outline" viewBox="0 0 24 24" fill="none">
              <path 
                d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                fill="none"
              />
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
    gap: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-row:hover {
    transform: translateY(-1px);
  }

  .comment-count {
    font-size: 14px;
    font-weight: 600;
    color: #65676b;
  }

  .comment-container {
    --comment-color: #764ba2; /* Pulse Purple - same as like button */
    position: relative;
    width: 40px;
    height: 40px;
    transition: .3s;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 50%;
  }

  .comment-container:hover {
    background-color: rgba(118, 75, 162, 0.1);
  }

  .comment-container .svg-container {
    width: 100%; 
    height: 100%;
    display: flex; 
    justify-content: center; 
    align-items: center;
  }

  .comment-container .svg-outline {
    color: var(--comment-color);
    width: 24px;
    height: 24px;
    transition: all 0.2s ease;
  }

  .comment-container:hover .svg-outline {
    color: #764ba2;
    transform: scale(1.1);
  }

  .action-row:active .comment-container {
    transform: scale(0.95);
  }
`;

export default CommentButton;