/**
 * @fileoverview ProfileView component for displaying user profile information
 * with comprehensive support for internationalization, RTL layouts, and accessibility
 * @version 1.0.0
 */

import React, { memo } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Grid,
  Paper,
  Container,
  Skeleton,
  IconButton
} from '@mui/material';
import { makeStyles } from '@mui/styles';
import { Edit as EditIcon } from '@mui/icons-material';

// Internal imports
import { User } from '../../interfaces/user.interface';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/useLanguage';
import ErrorBoundary from '../../components/common/ErrorBoundary';

// Props interface
interface ProfileViewProps {
  onEdit: () => void;
  className?: string;
}

// Custom styles with RTL support
const useProfileStyles = makeStyles((theme: any) => ({
  root: {
    padding: theme.spacing(3),
    direction: 'inherit',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(4),
  },
  avatar: {
    width: theme.spacing(12),
    height: theme.spacing(12),
    marginRight: ({ isRTL }: { isRTL: boolean }) => 
      isRTL ? 0 : theme.spacing(3),
    marginLeft: ({ isRTL }: { isRTL: boolean }) => 
      isRTL ? theme.spacing(3) : 0,
  },
  infoContainer: {
    padding: theme.spacing(3),
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
  },
  label: {
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },
  value: {
    color: theme.palette.text.primary,
    wordBreak: 'break-word',
  },
  editButton: {
    marginLeft: ({ isRTL }: { isRTL: boolean }) => 
      isRTL ? 0 : theme.spacing(2),
    marginRight: ({ isRTL }: { isRTL: boolean }) => 
      isRTL ? theme.spacing(2) : 0,
  },
}));

/**
 * ProfileView component displays user profile information with RTL and accessibility support
 */
const ProfileView: React.FC<ProfileViewProps> = memo(({ onEdit, className }) => {
  // Hooks
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  const classes = useProfileStyles({ isRTL });

  // Loading state when user data is not available
  if (!user) {
    return (
      <Container className={classes.root}>
        <Box className={classes.header}>
          <Skeleton variant="circular" width={96} height={96} />
          <Skeleton variant="rectangular" width={100} height={36} />
        </Box>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((item) => (
            <Grid item xs={12} sm={6} key={item}>
              <Skeleton variant="rectangular" height={100} />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  // Generate initials for avatar
  const getInitials = (firstName: string, lastName: string): string => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <ErrorBoundary>
      <Container 
        className={`${classes.root} ${className}`}
        component="main"
        role="main"
        aria-label={t('profile.title')}
      >
        <Paper elevation={0} className={classes.infoContainer}>
          <Box className={classes.header}>
            <Box display="flex" alignItems="center">
              <Avatar
                className={classes.avatar}
                aria-label={t('profile.userAvatar')}
              >
                {getInitials(user.firstName, user.lastName)}
              </Avatar>
              <Box>
                <Typography variant="h4" component="h1">
                  {`${user.firstName} ${user.lastName}`}
                </Typography>
                <Typography 
                  variant="body1" 
                  color="textSecondary"
                  aria-label={t('profile.role')}
                >
                  {t(`roles.${user.role}`)}
                </Typography>
              </Box>
            </Box>
            <IconButton
              onClick={onEdit}
              aria-label={t('profile.editProfile')}
              className={classes.editButton}
              color="primary"
            >
              <EditIcon />
            </IconButton>
          </Box>

          <Grid container spacing={4}>
            <Grid item xs={12} sm={6}>
              <Typography className={classes.label} variant="subtitle2">
                {t('profile.email')}
              </Typography>
              <Typography 
                className={classes.value} 
                variant="body1"
                aria-label={t('profile.emailLabel')}
              >
                {user.email}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography className={classes.label} variant="subtitle2">
                {t('profile.phone')}
              </Typography>
              <Typography 
                className={classes.value} 
                variant="body1"
                aria-label={t('profile.phoneLabel')}
              >
                {user.phoneNumber || t('profile.noPhone')}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography className={classes.label} variant="subtitle2">
                {t('profile.language')}
              </Typography>
              <Typography 
                className={classes.value} 
                variant="body1"
                aria-label={t('profile.languageLabel')}
              >
                {t(`languages.${user.preferredLanguage}`)}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography className={classes.label} variant="subtitle2">
                {t('profile.lastLogin')}
              </Typography>
              <Typography 
                className={classes.value} 
                variant="body1"
                aria-label={t('profile.lastLoginLabel')}
              >
                {new Intl.DateTimeFormat(user.preferredLanguage, {
                  dateStyle: 'long',
                  timeStyle: 'short'
                }).format(new Date(user.lastLoginAt))}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </ErrorBoundary>
  );
});

ProfileView.displayName = 'ProfileView';

export default ProfileView;