import { createContext, useContext, useState, useEffect, useMemo } from 'react'; // react v18.2.0
import { Theme, ThemeProvider as MuiThemeProvider, useMediaQuery } from '@mui/material'; // @mui/material v5.14.0
import { lightTheme, darkTheme } from '../config/theme';

// Storage keys for persisting preferences
const THEME_STORAGE_KEY = 'ijap-theme-mode';
const DIRECTION_STORAGE_KEY = 'ijap-direction';
const THEME_TRANSITION_DURATION = 300;

// Interface for theme context shape
interface ThemeContextType {
  theme: Theme;
  isDarkMode: boolean;
  isRTL: boolean;
  toggleTheme: () => void;
  toggleDirection: () => void;
}

// Props interface for ThemeProvider component
interface ThemeProviderProps {
  children: React.ReactNode;
}

// Create theme context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Custom hook for consuming theme context
export const useThemeContext = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};

// Theme provider component
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Check system preference for dark mode
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  
  // Initialize state from localStorage or system preference
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme ? savedTheme === 'dark' : prefersDarkMode;
  });

  // Initialize RTL state from localStorage
  const [isRTL, setIsRTL] = useState<boolean>(() => {
    const savedDirection = localStorage.getItem(DIRECTION_STORAGE_KEY);
    return savedDirection ? savedDirection === 'rtl' : false;
  });

  // Create theme based on current mode and direction
  const theme = useMemo(() => {
    const baseTheme = isDarkMode ? darkTheme : lightTheme;
    return {
      ...baseTheme,
      direction: isRTL ? 'rtl' : 'ltr',
      // Ensure typography uses correct font family based on direction
      typography: {
        ...baseTheme.typography,
        fontFamily: isRTL ? baseTheme.typography.hebrewFontFamily : baseTheme.typography.fontFamily,
      }
    };
  }, [isDarkMode, isRTL]);

  // Toggle theme with smooth transition
  const toggleTheme = () => {
    // Add transition class to body
    document.body.classList.add('theme-transition');
    
    setIsDarkMode(prev => {
      const newMode = !prev;
      localStorage.setItem(THEME_STORAGE_KEY, newMode ? 'dark' : 'light');
      return newMode;
    });

    // Remove transition class after animation completes
    setTimeout(() => {
      document.body.classList.remove('theme-transition');
    }, THEME_TRANSITION_DURATION);
  };

  // Toggle direction
  const toggleDirection = () => {
    setIsRTL(prev => {
      const newDirection = !prev;
      localStorage.setItem(DIRECTION_STORAGE_KEY, newDirection ? 'rtl' : 'ltr');
      return newDirection;
    });
  };

  // Update theme when system preference changes
  useEffect(() => {
    if (!localStorage.getItem(THEME_STORAGE_KEY)) {
      setIsDarkMode(prefersDarkMode);
    }
  }, [prefersDarkMode]);

  // Create memoized context value
  const contextValue = useMemo(() => ({
    theme,
    isDarkMode,
    isRTL,
    toggleTheme,
    toggleDirection,
  }), [theme, isDarkMode, isRTL]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};