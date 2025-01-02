import React, { useCallback, useMemo } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  useTheme,
  useMediaQuery,
} from '@mui/material'; // v5.14.0
import { ChevronLeft, ChevronRight } from '@mui/icons-material'; // v5.14.0
import { useNavigate, NavLink } from 'react-router-dom'; // v6.14.0

import { useAuth } from '../../hooks/useAuth';
import useLanguage from '../../hooks/useLanguage';
import routes from '../../config/routes';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  width: number;
  ariaLabel?: string;
}

const Sidebar: React.FC<SidebarProps> = React.memo(({
  open,
  onClose,
  width,
  ariaLabel = 'Main navigation sidebar'
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, validateRole } = useAuth();
  const { t, isRTL, currentLanguage } = useLanguage();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Filter navigation items based on user role and cultural context
  const getFilteredNavigationItems = useCallback(() => {
    return routes.filter(route => {
      // Skip routes without metadata
      if (!route.metadata) return false;

      // Check role-based access
      if (route.access === 'protected' && (!user || !validateRole(route.roles || []))) {
        return false;
      }

      // Check cultural context (if specified)
      if (route.metadata.culturalContext && 
          !route.metadata.culturalContext.includes(currentLanguage)) {
        return false;
      }

      return true;
    });
  }, [user, validateRole, currentLanguage]);

  // Memoize styles to prevent unnecessary recalculations
  const styles = useMemo(() => ({
    drawer: {
      width,
      flexShrink: 0,
      whiteSpace: 'nowrap',
      boxSizing: 'border-box',
      direction: isRTL ? 'rtl' : 'ltr',
    },
    drawerOpen: {
      width,
      transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
      }),
      overflowX: 'hidden',
    },
    drawerClose: {
      transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      }),
      overflowX: 'hidden',
      width: theme.spacing(7),
      [theme.breakpoints.down('sm')]: {
        width: 0,
      },
    },
    toolbar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: theme.spacing(0, 1),
      direction: isRTL ? 'rtl' : 'ltr',
    },
    navLink: {
      textDecoration: 'none',
      color: 'inherit',
      width: '100%',
      textAlign: isRTL ? 'right' : 'left',
    },
  }), [width, isRTL, theme]);

  // Handle navigation with analytics tracking
  const handleNavigation = useCallback((path: string) => {
    if (isMobile) {
      onClose();
    }
    navigate(path);
  }, [isMobile, onClose, navigate]);

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'permanent'}
      open={open}
      onClose={onClose}
      sx={{
        ...styles.drawer,
        ...(open ? styles.drawerOpen : styles.drawerClose),
      }}
      aria-label={ariaLabel}
    >
      <div className={styles.toolbar}>
        <IconButton 
          onClick={onClose}
          aria-label={t('common.close')}
          sx={{ transform: isRTL ? 'rotate(180deg)' : 'none' }}
        >
          {isRTL ? <ChevronRight /> : <ChevronLeft />}
        </IconButton>
      </div>

      <Divider />

      <List role="navigation">
        {getFilteredNavigationItems().map((route) => (
          <ListItem
            key={route.path}
            disablePadding
            sx={{ display: 'block' }}
          >
            <NavLink
              to={route.path || ''}
              className={styles.navLink}
              onClick={() => handleNavigation(route.path || '')}
              style={({ isActive }) => ({
                backgroundColor: isActive ? theme.palette.action.selected : 'transparent',
              })}
            >
              <ListItem
                sx={{
                  minHeight: 48,
                  justifyContent: open ? 'initial' : 'center',
                  px: 2.5,
                }}
                role="menuitem"
                aria-label={route.metadata.title}
              >
                {route.icon && (
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: open ? 3 : 'auto',
                      justifyContent: 'center',
                    }}
                  >
                    {route.icon}
                  </ListItemIcon>
                )}
                <ListItemText
                  primary={t(`navigation.${route.metadata.title}`)}
                  sx={{
                    opacity: open ? 1 : 0,
                    direction: isRTL ? 'rtl' : 'ltr',
                  }}
                />
              </ListItem>
            </NavLink>
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;