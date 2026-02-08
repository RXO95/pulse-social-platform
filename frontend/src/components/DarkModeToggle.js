import styled from "styled-components";
import { useTheme } from "../context/ThemeContext";

const ToggleWrapper = styled.div`
  .toggle-switch {
    position: relative;
    width: 54px;
    height: 28px;
    cursor: pointer;
  }

  .toggle-switch input[type="checkbox"] {
    display: none;
  }

  .toggle-switch label {
    position: absolute;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #87ceeb, #e0f0ff);
    border-radius: 50px;
    cursor: pointer;
    transition: 0.4s;
    overflow: hidden;
  }

  .toggle-switch input:checked + label {
    background: linear-gradient(135deg, #1a1a2e, #16213e);
  }

  /* Circle (sun/moon) */
  .toggle-switch label::before {
    content: "";
    position: absolute;
    width: 22px;
    height: 22px;
    background: #fdb813;
    border-radius: 50%;
    top: 3px;
    left: 3px;
    transition: 0.4s;
    box-shadow: 0 0 8px rgba(253, 184, 19, 0.6);
  }

  .toggle-switch input:checked + label::before {
    left: 29px;
    background: #f0f0f0;
    box-shadow: inset -4px -2px 0 0 #d4d4d4;
  }

  /* Stars (visible in dark) */
  .toggle-switch label::after {
    content: "✦ ✧";
    position: absolute;
    top: 5px;
    left: 8px;
    font-size: 8px;
    color: transparent;
    letter-spacing: 3px;
    transition: 0.3s;
  }

  .toggle-switch input:checked + label::after {
    color: rgba(255, 255, 255, 0.7);
  }
`;

export default function DarkModeToggle() {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <ToggleWrapper>
      <div className="toggle-switch">
        <input
          type="checkbox"
          id="dark-mode-toggle"
          checked={darkMode}
          onChange={toggleDarkMode}
        />
        <label htmlFor="dark-mode-toggle" />
      </div>
    </ToggleWrapper>
  );
}
