// @mui/material v5.14.0
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Typography } from '@mui/material';
// @mui/icons-material v5.14.0
import { Close } from '@mui/icons-material';
// react v18.2.0
import React from 'react';
// Internal imports
import { lightTheme } from '../../config/theme';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmButtonColor?: 'primary' | 'secondary' | 'error' | 'warning';
  direction?: 'ltr' | 'rtl';
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmButtonColor = 'primary',
  direction = lightTheme.direction,
  ariaLabelledBy = 'confirm-dialog-title',
  ariaDescribedBy = 'confirm-dialog-description'
}) => {
  // Handle keyboard events for accessibility
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onCancel();
    }
  };

  // Handle confirm with keyboard support
  const handleConfirm = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.preventDefault();
    onConfirm();
  };

  // Handle cancel with keyboard support
  const handleCancel = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.preventDefault();
    onCancel();
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      onKeyDown={handleKeyDown}
      dir={direction}
      sx={{
        '& .MuiDialog-paper': {
          minWidth: '300px',
          maxWidth: '500px',
          margin: (theme) => theme.spacing(2),
          direction: direction
        }
      }}
    >
      <DialogTitle
        id={ariaLabelledBy}
        sx={{
          padding: (theme) => theme.spacing(2),
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
          onClick={handleCancel}
          sx={{
            position: 'absolute',
            ...(direction === 'ltr' ? { right: 8 } : { left: 8 }),
            top: 8,
            color: (theme) => theme.palette.grey[500]
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent
        id={ariaDescribedBy}
        sx={{
          padding: (theme) => theme.spacing(2),
          direction: 'inherit',
          textAlign: direction === 'rtl' ? 'right' : 'left'
        }}
      >
        {typeof message === 'string' ? (
          <Typography variant="body1">{message}</Typography>
        ) : (
          message
        )}
      </DialogContent>

      <DialogActions
        sx={{
          padding: (theme) => theme.spacing(1, 2, 2),
          display: 'flex',
          justifyContent: 'flex-end',
          gap: (theme) => theme.spacing(1),
          flexDirection: direction === 'rtl' ? 'row-reverse' : 'row'
        }}
      >
        <Button
          onClick={handleCancel}
          color="inherit"
          variant="outlined"
          aria-label={cancelLabel}
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={handleConfirm}
          color={confirmButtonColor}
          variant="contained"
          aria-label={confirmLabel}
          autoFocus
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;