import React, { useState, useCallback, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Button,
  Box,
  Divider,
  useMediaQuery,
  Fade,
  Tooltip
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle,
  Language,
  KeyboardArrowDown
} from '@mui/icons-material';
import { useNavigate, NavLink, useLocation } from 'react-router-dom';

import routes from '../../config/routes';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import LanguageSelector from './LanguageSelector';
import ThemeToggle from './ThemeToggle';

interface NavigationItem {
  path: string;
  label: string;
  roles: string[];
  icon?: React.ReactNode;
}

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isLoading } = useAuth();
  const { t, isRTL, currentLanguage } = useLanguage();
  const isMobile = useMediaQuery('(max-width:900px)');

  // Menu state
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState<null | HTMLElement>(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [languageMenuAnchor, setLanguageMenuAnchor] = useState<null | HTMLElement>(null);

  // Filter navigation items based on user role
  const navigationItems = routes.filter(route => {
    if (route.access === 'public') return true;
    if (!user) return false;
    return !route.roles || route.roles.includes(user.role);
  });

  // Handle menu opening/closing
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

  // Handle logout with cleanup
  const handleLogout = async () => {
    try {
      await logout();
      handleUserMenuClose();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent, callback: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  }, []);

  // Close menus on route change
  useEffect(() => {
    handleMobileMenuClose();
    handleUserMenuClose();
  }, [location.pathname]);

  return (
    <AppBar 
      position="fixed"
      sx={{
        direction: isRTL ? 'rtl' : 'ltr',
        transition: 'all 0.3s ease'
      }}
    >
      <Toolbar>
        {isMobile && (
          <IconButton
            edge="start"
            color="inherit"
            aria-label={t('navigation.menu')}
            onClick={handleMobileMenuOpen}
            sx={{ marginRight: isRTL ? 0 : 2, marginLeft: isRTL ? 2 : 0 }}
          >
            <MenuIcon />
          </IconButton>
        )}

        <Typography
          variant="h6"
          component={NavLink}
          to="/"
          sx={{
            flexGrow: 1,
            textDecoration: 'none',
            color: 'inherit',
            fontWeight: 'bold'
          }}
        >
          {t('navigation.title')}
        </Typography>

        {!isMobile && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {navigationItems.map((item) => (
              <Button
                key={item.path}
                component={NavLink}
                to={item.path}
                color="inherit"
                sx={{
                  textTransform: 'none',
                  '&.active': {
                    fontWeight: 'bold',
                    borderBottom: '2px solid',
                  }
                }}
              >
                {t(`navigation.${item.label}`)}
              </Button>
            ))}
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LanguageSelector size="small" />
          <ThemeToggle size="small" />

          {user ? (
            <>
              <Tooltip title={t('navigation.account')}>
                <IconButton
                  color="inherit"
                  onClick={handleUserMenuOpen}
                  aria-label={t('navigation.account')}
                >
                  <AccountCircle />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={handleUserMenuClose}
                TransitionComponent={Fade}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: isRTL ? 'right' : 'left',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: isRTL ? 'right' : 'left',
                }}
              >
                <MenuItem
                  onClick={() => {
                    handleUserMenuClose();
                    navigate('/profile');
                  }}
                >
                  {t('navigation.profile')}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    handleUserMenuClose();
                    navigate('/settings');
                  }}
                >
                  {t('navigation.settings')}
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout}>
                  {t('navigation.logout')}
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button
              color="inherit"
              onClick={() => navigate('/login')}
              sx={{ textTransform: 'none' }}
            >
              {t('navigation.login')}
            </Button>
          )}
        </Box>

        {/* Mobile Menu */}
        <Menu
          anchorEl={mobileMenuAnchor}
          open={Boolean(mobileMenuAnchor)}
          onClose={handleMobileMenuClose}
          TransitionComponent={Fade}
          sx={{
            '& .MuiPaper-root': {
              width: '100%',
              maxWidth: 300,
              mt: 1.5
            }
          }}
        >
          {navigationItems.map((item) => (
            <MenuItem
              key={item.path}
              onClick={() => {
                handleMobileMenuClose();
                navigate(item.path);
              }}
              selected={location.pathname === item.path}
            >
              {t(`navigation.${item.label}`)}
            </MenuItem>
          ))}
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default Navigation;