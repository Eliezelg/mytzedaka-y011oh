/**
 * @fileoverview Main layout component that provides the consistent structure for all pages
 * with responsive design, RTL support, theme switching, and accessibility features
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Container,
  CssBaseline,
  useMediaQuery,
  useTheme
} from '@mui/material'; // v5.14.0

// Internal components
import Header from './Header';
import Footer from './Footer';
import Sidebar from './Sidebar';
import { useLanguage } from '../../hooks/useLanguage';

// Interface for component props
interface MainLayoutProps {
  /** Child components to render in the main content area */
  children: React.ReactNode;
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Optional flag to disable sidebar */
  disableSidebar?: boolean;
  /** Optional container width setting */
  maxWidth?: false | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

// Sidebar width constant
const SIDEBAR_WIDTH = 240;

/**
 * Main layout component that wraps all pages with consistent structure
 * and enhanced features for the International Jewish Association Donation Platform
 */
const MainLayout: React.FC<MainLayoutProps> = React.memo(({
  children,
  className,
  disableSidebar = false,
  maxWidth = 'lg'
}) => {
  // Theme and responsive hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isRTL, direction } = useLanguage();

  // Sidebar state management
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);

  // Handle sidebar toggle
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  // Update sidebar state on screen size changes
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    } else {
      setIsSidebarOpen(!disableSidebar);
    }
  }, [isMobile, disableSidebar]);

  // Handle reduced motion preference
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        direction,
        transition: prefersReducedMotion ? 'none' : 'all 225ms cubic-bezier(0.4, 0, 0.6, 1) 0ms',
        '@media print': {
          height: 'auto'
        }
      }}
      className={className}
    >
      <CssBaseline />

      <Header 
        onSidebarToggle={handleSidebarToggle}
        isSidebarOpen={isSidebarOpen}
      />

      {!disableSidebar && (
        <Sidebar
          open={isSidebarOpen}
          onClose={handleSidebarToggle}
          width={SIDEBAR_WIDTH}
          ariaLabel="Main navigation sidebar"
        />
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          padding: theme.spacing(3),
          marginTop: '64px', // Header height
          marginLeft: {
            sm: !disableSidebar && isSidebarOpen ? `${SIDEBAR_WIDTH}px` : 0,
            xs: 0
          },
          marginRight: {
            sm: !disableSidebar && isSidebarOpen && isRTL ? `${SIDEBAR_WIDTH}px` : 0,
            xs: 0
          },
          transition: prefersReducedMotion ? 'none' : 'margin 225ms cubic-bezier(0.4, 0, 0.6, 1) 0ms'
        }}
        role="main"
        aria-label="Main content"
      >
        <Container
          maxWidth={maxWidth}
          sx={{
            position: 'relative',
            direction: 'inherit'
          }}
        >
          {children}
        </Container>
      </Box>

      <Footer />
    </Box>
  );
});

// Display name for debugging
MainLayout.displayName = 'MainLayout';

export default MainLayout;