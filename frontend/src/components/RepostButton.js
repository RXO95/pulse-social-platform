import React, { useState } from 'react';
import styled from 'styled-components';
import { useTheme, getTheme } from '../context/ThemeContext';

const ACTIVE_COLOR = '#00ba7c';

const RepostButton = ({ isReposted, count = 0, onRepost, onQuoteRepost }) => {
  const [showMenu, setShowMenu] = useState(false);
  const { darkMode, background } = useTheme();
  const t = getTheme(darkMode, background);
  const defaultColor = t.textSecondary || '#71767b';

  return (
    <StyledWrapper $active={isReposted} $defaultColor={defaultColor} $cardBg={t.cardBg} $text={t.text} $border={t.border}>
      <div className="action-row">
        <div
          title="Repost"
          className={`repost-container${isReposted ? ' active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
        >
          <div className="svg-container">
            <svg viewBox="0 0 24 24" width="20" height="20" className="repost-icon">
              <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
            </svg>
          </div>
        </div>
        <span className="repost-count">{count || ''}</span>

        {showMenu && (
          <>
            <div className="menu-backdrop" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
            <div className="repost-menu" onClick={e => e.stopPropagation()}>
              <button
                className="menu-item"
                onClick={() => {
                  setShowMenu(false);
                  onRepost && onRepost();
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z" />
                </svg>
                {isReposted ? 'Undo Repost' : 'Repost'}
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  setShowMenu(false);
                  onQuoteRepost && onQuoteRepost();
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M14.23 2.854c.98-.977 2.56-.977 3.54 0l3.38 3.378c.97.977.97 2.559 0 3.536L9.91 21H3v-6.914L14.23 2.854zm2.12 1.414c-.19-.195-.51-.195-.7 0L4.41 15.51V19h3.49L19.14 7.768c.2-.195.2-.512 0-.707l-3.38-3.378zM14.59 10.11l-3.38-3.378L8.68 9.261l3.38 3.378 2.53-2.529z"/>
                </svg>
                Quote
              </button>
            </div>
          </>
        )}
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .action-row {
    display: flex;
    align-items: center;
    gap: 2px;
    position: relative;
  }

  .repost-count {
    font-size: 13px;
    font-weight: 500;
    color: ${p => p.$active ? ACTIVE_COLOR : p.$defaultColor};
    min-width: 8px;
    transition: color 0.2s;
  }

  .repost-container {
    position: relative;
    width: 35px;
    height: 35px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s;
  }

  .repost-container:hover {
    background-color: rgba(0, 186, 124, 0.1);
  }

  .repost-container .svg-container {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .repost-container .repost-icon {
    fill: ${p => p.$defaultColor};
    transition: fill 0.2s;
  }

  .repost-container:hover .repost-icon {
    fill: ${ACTIVE_COLOR};
  }

  .action-row:hover .repost-count {
    color: ${ACTIVE_COLOR};
  }

  .repost-container.active .repost-icon {
    fill: ${ACTIVE_COLOR};
  }

  .menu-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 999;
  }

  .repost-menu {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    background: ${p => p.$cardBg};
    border: 1px solid ${p => p.$border};
    border-radius: 12px;
    padding: 4px 0;
    min-width: 180px;
    box-shadow: 0 8px 28px rgba(0,0,0,0.35);
    z-index: 1000;
    overflow: hidden;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 14px 16px;
    border: none;
    background: none;
    color: ${p => p.$text};
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .menu-item:hover {
    background: rgba(128,128,128,0.12);
  }
`;

export default RepostButton;
