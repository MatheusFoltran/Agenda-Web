import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  isDarkMode: boolean;
  onToggle: () => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ isDarkMode, onToggle }) => {
  return (
    <div className="theme-toggle-container">
      <button 
        className="theme-toggle-button"
        onClick={onToggle}
        aria-label={isDarkMode ? "Mudar para tema claro" : "Mudar para tema escuro"}
      >
        <div className={`toggle-track ${isDarkMode ? 'dark' : 'light'}`}>
          <div className="toggle-icons">
            <span className="sun-icon">
              <Sun size={16} />
            </span>
            <span className="moon-icon">
              <Moon size={16} />
            </span>
          </div>
          <div className={`toggle-thumb ${isDarkMode ? 'dark' : 'light'}`} />
        </div>
      </button>
    </div>
  );
};

export default ThemeToggle;