/**
 * @fileoverview Footer component with RTL support, accessibility features, and language selection
 * @version 1.0.0
 */

import React, { memo, useCallback } from 'react';
import { Box, Container, Typography, Link, useTheme } from '@mui/material'; // v5.14.0
import useLanguage from '../../hooks/useLanguage';
import LanguageSelector from './LanguageSelector';

/**
 * Props interface for the Footer component
 */
interface FooterProps {
  className?: string;
  ariaLabel?: string;
}

/**
 * Returns the current year for copyright notice
 */
const getCurrentYear = (): number => new Date().getFullYear();

/**
 * Footer component with RTL support and accessibility features
 */
const Footer: React.FC<FooterProps> = memo(({ 
  className,
  ariaLabel = 'Site footer'
}) => {
  const theme = useTheme();
  const { t, direction } = useLanguage();
  const currentYear = getCurrentYear();

  /**
   * Handles link clicks with analytics tracking
   */
  const handleLinkClick = useCallback((event: React.MouseEvent, linkType: string) => {
    event.preventDefault();
    // Track link click in analytics (implementation depends on analytics service)
    console.info(`Footer link clicked: ${linkType}`);
    // Navigate to target URL
    window.location.href = event.currentTarget.getAttribute('href') || '/';
  }, []);

  /**
   * Renders footer links with proper RTL support
   */
  const renderLinks = useCallback(() => (
    <Box
      component="nav"
      sx={{
        display: 'flex',
        gap: theme.spacing(2),
        flexWrap: 'wrap',
        justifyContent: 'center',
        direction: 'inherit'
      }}
      aria-label="Footer navigation"
    >
      <Link
        href="/privacy"
        onClick={(e) => handleLinkClick(e, 'privacy')}
        sx={{
          color: 'text.secondary',
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
          padding: theme.spacing(1),
          minWidth: '44px',
          minHeight: '44px',
          display: 'inline-flex',
          alignItems: 'center'
        }}
        aria-label={t('footer.privacy')}
      >
        {t('footer.privacy')}
      </Link>
      <Link
        href="/terms"
        onClick={(e) => handleLinkClick(e, 'terms')}
        sx={{
          color: 'text.secondary',
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
          padding: theme.spacing(1),
          minWidth: '44px',
          minHeight: '44px',
          display: 'inline-flex',
          alignItems: 'center'
        }}
        aria-label={t('footer.terms')}
      >
        {t('footer.terms')}
      </Link>
      <Link
        href="/contact"
        onClick={(e) => handleLinkClick(e, 'contact')}
        sx={{
          color: 'text.secondary',
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
          padding: theme.spacing(1),
          minWidth: '44px',
          minHeight: '44px',
          display: 'inline-flex',
          alignItems: 'center'
        }}
        aria-label={t('footer.contact')}
      >
        {t('footer.contact')}
      </Link>
    </Box>
  ), [t, theme, handleLinkClick]);

  /**
   * Renders copyright notice with RTL support
   */
  const renderCopyright = useCallback(() => (
    <Typography
      variant="body2"
      color="text.secondary"
      align={direction === 'rtl' ? 'right' : 'left'}
      sx={{ textAlign: 'inherit' }}
    >
      {t('footer.copyright', { year: currentYear })}
    </Typography>
  ), [t, currentYear, direction]);

  return (
    <Box
      component="footer"
      className={className}
      sx={{
        borderTop: '1px solid',
        borderColor: 'divider',
        marginTop: 'auto',
        padding: theme.spacing(3, 0),
        direction: 'inherit'
      }}
      aria-label={ariaLabel}
    >
      <Container
        maxWidth="lg"
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: theme.spacing(2),
          textAlign: 'inherit'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center',
            gap: theme.spacing(2)
          }}
        >
          {renderCopyright()}
          <LanguageSelector
            size="small"
            variant="outlined"
          />
        </Box>
        {renderLinks()}
      </Container>
    </Box>
  );
});

// Display name for debugging
Footer.displayName = 'Footer';

export default Footer;