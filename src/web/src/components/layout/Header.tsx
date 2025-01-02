/**
 * @fileoverview Main header component for the web application providing navigation,
 * language selection, theme toggling, and authentication status with responsive design
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  CircularProgress,
  Skeleton,
  useMediaQuery,
} from '@mui/material'; // v5.14.0
import { MenuIcon, AccountCircle, ErrorOutline } from '@mui/icons-material'; // v5.14.0
import { useNavigate } from 'react-router-dom'; // v6.0.0
import LanguageSelector from './LanguageSelector';
import ThemeToggle from './ThemeToggle';
import PageHeader from '../common/PageHeader';
import { useAuth } from '../../hooks/useAuth';

// Props interface for Header component
interface HeaderProps {
  className?: string;
  ariaLabel?: string;
  testId?: string;
}

// Navigation item structure
interface NavItem {
  label: string;
  path: string;
  requiresAuth: boolean;
  roles: string[];
  icon?: React.ReactNode;
}

// Navigation items configuration
const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '/', requiresAuth: false, roles: [] },
  { label: 'Associations', path: '/associations', requiresAuth: false, roles: [] },
  { label: 'Campaigns', path: '/campaigns', requiresAuth: false, roles: [] },
  { label: 'Donations', path: '/donations', requiresAuth: true, roles: ['donor', 'admin'] },
  { label: 'Profile', path: '/profile', requiresAuth: true, roles: ['donor', 'admin', 'association'] }
];

// Menu IDs for accessibility
const MOBILE_MENU_ID = 'primary-mobile-menu';
const DESKTOP_MENU_ID = 'primary-desktop-menu';
const TRANSITION_DURATION = 300;

/**
 * Enhanced header component with responsive design and accessibility features
 */
const Header: React.FC<HeaderProps> = React.memo(({
  className,
  ariaLabel = 'Main navigation',
  testId = 'header-component'
}) => {
  // Hooks
  const { user, loading, error } = useAuth();
  const isMobile = useMediaQuery('(max-width:900px)');
  const navigate = useNavigate();

  // State
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState<null | HTMLElement>(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  // Computed values
  const isMobileMenuOpen = Boolean(mobileMenuAnchor);
  const isUserMenuOpen = Boolean(userMenuAnchor);

  // Filter navigation items based on auth state and user roles
  const filteredNavItems = NAV_ITEMS.filter(item => {
    if (item.requiresAuth && !user) return false;
    if (item.roles.length > 0 && !item.roles.includes(user?.role || '')) return false;
    return true;
  });

  // Menu handlers
  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMenuAnchor(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null);
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  // Navigation handler
  const handleNavigation = useCallback((path: string) => {
    navigate(path);
    handleMobileMenuClose();
    handleUserMenuClose();
  }, [navigate]);

  // Keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent, path: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNavigation(path);
    }
  }, [handleNavigation]);

  // Clean up menus on unmount
  useEffect(() => {
    return () => {
      handleMobileMenuClose();
      handleUserMenuClose();
    };
  }, []);

  // Render mobile menu
  const renderMobileMenu = (
    <Menu
      anchorEl={mobileMenuAnchor}
      id={MOBILE_MENU_ID}
      keepMounted
      open={isMobileMenuOpen}
      onClose={handleMobileMenuClose}
      PaperProps={{
        elevation: 0,
        sx: {
          mt: 1.5,
          overflow: 'visible',
          filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
          '& .MuiAvatar-root': {
            width: 32,
            height: 32,
            ml: -0.5,
            mr: 1,
          },
        },
      }}
      transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
    >
      {filteredNavItems.map((item) => (
        <MenuItem
          key={item.path}
          onClick={() => handleNavigation(item.path)}
          onKeyDown={(e) => handleKeyDown(e, item.path)}
          role="menuitem"
        >
          {item.label}
        </MenuItem>
      ))}
    </Menu>
  );

  // Render loading state
  if (loading) {
    return (
      <AppBar position="fixed" className={className} sx={styles.appBar}>
        <Toolbar sx={styles.toolbar}>
          <Skeleton variant="rectangular" width={120} height={40} />
          <Box sx={styles.rightSection}>
            <Skeleton variant="circular" width={40} height={40} />
            <Skeleton variant="circular" width={40} height={40} />
          </Box>
        </Toolbar>
      </AppBar>
    );
  }

  // Render error state
  if (error) {
    return (
      <AppBar position="fixed" className={className} sx={{ ...styles.appBar, ...styles.errorState }}>
        <Toolbar sx={styles.toolbar}>
          <Box display="flex" alignItems="center" gap={1}>
            <ErrorOutline color="error" />
            <span>Navigation error: {error.message}</span>
          </Box>
        </Toolbar>
      </AppBar>
    );
  }

  return (
    <AppBar 
      position="fixed" 
      className={className}
      sx={styles.appBar}
      role="banner"
      aria-label={ariaLabel}
      data-testid={testId}
    >
      <Toolbar sx={styles.toolbar}>
        {isMobile && (
          <IconButton
            edge="start"
            color="inherit"
            aria-label="Open menu"
            aria-controls={MOBILE_MENU_ID}
            aria-haspopup="true"
            aria-expanded={isMobileMenuOpen}
            onClick={handleMobileMenuOpen}
          >
            <MenuIcon />
          </IconButton>
        )}

        <Box sx={styles.navItems}>
          {!isMobile && filteredNavItems.map((item) => (
            <Button
              key={item.path}
              color="inherit"
              onClick={() => handleNavigation(item.path)}
              onKeyDown={(e) => handleKeyDown(e, item.path)}
              aria-current={location.pathname === item.path ? 'page' : undefined}
            >
              {item.label}
            </Button>
          ))}
        </Box>

        <Box sx={styles.rightSection}>
          <LanguageSelector size="small" />
          <ThemeToggle size="small" />
          
          {user ? (
            <IconButton
              aria-label="User account"
              aria-controls={DESKTOP_MENU_ID}
              aria-haspopup="true"
              aria-expanded={isUserMenuOpen}
              onClick={handleUserMenuOpen}
              color="inherit"
            >
              <AccountCircle />
            </IconButton>
          ) : (
            <Button
              color="inherit"
              onClick={() => handleNavigation('/login')}
              aria-label="Login"
            >
              Login
            </Button>
          )}
        </Box>
      </Toolbar>

      {renderMobileMenu}
    </AppBar>
  );
});

// Styles
const styles = {
  appBar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1100,
    transition: `all ${TRANSITION_DURATION}ms ease`,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 16px',
    minHeight: {
      xs: '56px',
      sm: '64px',
    },
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  navItems: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  mobileMenu: {
    display: {
      xs: 'block',
      md: 'none',
    },
    position: 'relative',
  },
  desktopMenu: {
    display: {
      xs: 'none',
      md: 'flex',
    },
    alignItems: 'center',
  },
  loadingState: {
    opacity: 0.7,
    pointerEvents: 'none',
  },
  errorState: {
    color: 'error.main',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
};

// Display name for debugging
Header.displayName = 'Header';

export default Header;