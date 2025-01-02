// @mui/material v5.14.0
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Typography } from '@mui/material';
// @mui/icons-material v5.14.0
import { Close } from '@mui/icons-material';
// react v18.2.0
import React from 'react';
import { lightTheme } from '../../config/theme';

interface AlertDialogProps {
  open: boolean;
  title: string;
  message: string | React.ReactNode;
  severity: 'error' | 'warning' | 'info' | 'success';
  onClose: () => void;
  actionLabel?: string;
  onAction?: () => void;
  ariaLabel: string;
  dir?: 'ltr' | 'rtl';
}

const AlertDialog: React.FC<AlertDialogProps> = React.memo(({
  open,
  title,
  message,
  severity,
  onClose,
  actionLabel,
  onAction,
  ariaLabel,
  dir = 'ltr'
}) => {
  // Style configurations based on severity and theme
  const severityStyles = {
    error: {
      backgroundColor: lightTheme.palette.error.light,
      color: lightTheme.palette.error.main,
      borderColor: lightTheme.palette.error.main
    },
    warning: {
      backgroundColor: lightTheme.palette.warning.light,
      color: lightTheme.palette.warning.main,
      borderColor: lightTheme.palette.warning.main
    },
    info: {
      backgroundColor: lightTheme.palette.info.light,
      color: lightTheme.palette.info.main,
      borderColor: lightTheme.palette.info.main
    },
    success: {
      backgroundColor: lightTheme.palette.success.light,
      color: lightTheme.palette.success.main,
      borderColor: lightTheme.palette.success.main
    }
  };

  // Handle keyboard events for accessibility
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      aria-label={ariaLabel}
      dir={dir}
      onKeyDown={handleKeyDown}
      PaperProps={{
        style: {
          ...severityStyles[severity],
          minWidth: '320px',
          maxWidth: '500px'
        }
      }}
    >
      <DialogTitle
        id="alert-dialog-title"
        sx={{
          padding: lightTheme.spacing(2),
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          direction: 'inherit'
        }}
      >
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        <IconButton
          aria-label="close"
          onClick={onClose}
          size="small"
          sx={{
            position: 'absolute',
            right: dir === 'ltr' ? lightTheme.spacing(1) : 'auto',
            left: dir === 'rtl' ? lightTheme.spacing(1) : 'auto',
            top: lightTheme.spacing(1),
            color: 'inherit'
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          padding: lightTheme.spacing(2),
          direction: 'inherit'
        }}
      >
        <Typography
          id="alert-dialog-description"
          variant="body1"
          component="div"
          sx={{ color: 'inherit' }}
        >
          {message}
        </Typography>
      </DialogContent>

      <DialogActions
        sx={{
          padding: lightTheme.spacing(1, 2, 2),
          display: 'flex',
          justifyContent: 'flex-end',
          gap: lightTheme.spacing(1),
          direction: 'inherit'
        }}
      >
        <Button
          onClick={onClose}
          variant="outlined"
          color="inherit"
          aria-label="close dialog"
        >
          {dir === 'rtl' ? 'סגור' : 'Close'}
        </Button>
        {actionLabel && onAction && (
          <Button
            onClick={onAction}
            variant="contained"
            color="inherit"
            autoFocus
            aria-label={actionLabel}
          >
            {actionLabel}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
});

AlertDialog.displayName = 'AlertDialog';

export default AlertDialog;