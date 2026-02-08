import React from 'react';
import styled from 'styled-components';
import { useTheme, getTheme } from '../context/ThemeContext';

const PostLoader = () => {
  const { darkMode } = useTheme();
  const t = getTheme(darkMode);

  return (
    <StyledWrapper $bg={t.cardBg} $border={t.border} $shimmer={darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(227,227,227,0.5)'} $lineBg={darkMode ? '#2f3336' : '#eff3f4'}>
      <div className="loader">
        <div className="wrapper">
          <div className="circle" />
          <div className="line-1" />
          <div className="line-2" />
          <div className="line-3" />
          <div className="line-4" />
        </div>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  .loader {
    position: relative;
    width: 100%;
    height: 130px;
    margin-bottom: 0;
    border-bottom: 1px solid ${props => props.$border};
    padding: 16px;
    background-color: ${props => props.$bg};
    overflow: hidden;
  }

  .loader:after {
    content: "";
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    background: linear-gradient(110deg, transparent 0%, transparent 40%, ${props => props.$shimmer} 50%, transparent 60%, transparent 100%);
    animation: gradient-animation_2 1.2s linear infinite;
  }

  .loader .wrapper {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .loader .wrapper > div {
    background-color: ${props => props.$lineBg};
    border-radius: 4px;
  }

  .loader .circle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }

  .loader .button {
    display: inline-block;
    height: 32px;
    width: 75px;
  }

  .loader .line-1 {
    position: absolute;
    top: 8px;
    left: 56px;
    height: 10px;
    width: 100px;
  }

  .loader .line-2 {
    position: absolute;
    top: 28px;
    left: 56px;
    height: 10px;
    width: 150px;
  }

  .loader .line-3 {
    position: absolute;
    top: 57px;
    left: 0px;
    height: 10px;
    width: 100%;
  }

  .loader .line-4 {
    position: absolute;
    top: 80px;
    left: 0px;
    height: 10px;
    width: 92%;
  }

  @keyframes gradient-animation_2 {
    0% {
      transform: translateX(-100%);
    }

    100% {
      transform: translateX(100%);
    }
  }`;

export default PostLoader;
