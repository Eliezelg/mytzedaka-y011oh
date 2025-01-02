import React, { useCallback, useState, useRef } from 'react';
import { Box, Button, Typography, IconButton, LinearProgress, Tooltip } from '@mui/material';
import { CloudUpload, Close, Warning, CheckCircle } from '@mui/icons-material';
import StorageService from '../../services/storage.service';
import LoadingSpinner from './LoadingSpinner';

// Interfaces for component props and state
interface FileMetadata {
  fileName: string;
  contentType: string;
  size: number;
  securityLevel: 'public' | 'private' | 'sensitive';
  checksum?: string;
  uploadDate: string;
}

interface FileUploadError {
  code: string;
  message: string;
  fileName?: string;
}

interface CompressionOptions {
  enabled: boolean;
  quality?: number;
  maxSize?: number;
}

interface EncryptionOptions {
  enabled: boolean;
  level?: 'AES-256-GCM' | 'AES-256-CBC';
}

interface WatermarkOptions {
  enabled: boolean;
  text?: string;
  opacity?: number;
}

interface FileUploadProps {
  onFileUpload: (file: File, url: string, metadata: FileMetadata) => void;
  onError: (error: FileUploadError) => void;
  acceptedTypes: string[];
  maxSize: number;
  isSecure?: boolean;
  multiple?: boolean;
  compressionOptions?: CompressionOptions;
  encryptionOptions?: EncryptionOptions;
  watermarkOptions?: WatermarkOptions;
}

interface UploadState {
  files: File[];
  uploading: boolean;
  progress: number;
  error?: FileUploadError;
  completed: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileUpload,
  onError,
  acceptedTypes,
  maxSize,
  isSecure = false,
  multiple = false,
  compressionOptions = { enabled: false },
  encryptionOptions = { enabled: false },
  watermarkOptions = { enabled: false }
}) => {
  const [state, setState] = useState<UploadState>({
    files: [],
    uploading: false,
    progress: 0,
    completed: false
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const storageService = new StorageService({
    baseUrl: process.env.REACT_APP_STORAGE_API_URL || '',
    storageType: isSecure ? 'secure' : 'local',
    maxFileSize: maxSize
  });

  const validateFile = (file: File): FileUploadError | null => {
    if (!acceptedTypes.includes(file.type)) {
      return {
        code: 'INVALID_TYPE',
        message: `File type ${file.type} is not supported`,
        fileName: file.name
      };
    }

    if (file.size > maxSize) {
      return {
        code: 'FILE_TOO_LARGE',
        message: `File size exceeds ${maxSize} bytes`,
        fileName: file.name
      };
    }

    return null;
  };

  const processFile = async (file: File): Promise<{ success: boolean; url?: string; metadata?: FileMetadata }> => {
    try {
      // Scan file for viruses
      const scanResult = await storageService.scanFile(file);
      if (!scanResult.success) {
        throw new Error('Virus detected in file');
      }

      // Compress file if enabled
      let processedFile = file;
      if (compressionOptions.enabled) {
        const compressResult = await storageService.compressFile(file, compressionOptions);
        if (compressResult.success) {
          processedFile = compressResult.data;
        }
      }

      // Encrypt file if enabled
      if (encryptionOptions.enabled) {
        const encryptResult = await storageService.encryptFile(processedFile, encryptionOptions);
        if (!encryptResult.success) {
          throw new Error('File encryption failed');
        }
        processedFile = encryptResult.data;
      }

      // Store the processed file
      const result = await storageService.storeDocument(
        `uploads/${Date.now()}-${file.name}`,
        processedFile,
        isSecure,
        {
          securityLevel: isSecure ? 'sensitive' : 'public',
          tags: ['user-upload']
        }
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return {
        success: true,
        url: result.url,
        metadata: result.metadata as FileMetadata
      };
    } catch (error) {
      console.error('File processing error:', error);
      return { success: false };
    }
  };

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const droppedFiles = Array.from(event.dataTransfer.files);
    if (!multiple && droppedFiles.length > 1) {
      onError({ code: 'MULTIPLE_FILES', message: 'Multiple files not allowed' });
      return;
    }

    setState(prev => ({ ...prev, files: droppedFiles, uploading: true, progress: 0 }));
    
    for (const file of droppedFiles) {
      const validationError = validateFile(file);
      if (validationError) {
        onError(validationError);
        continue;
      }

      const result = await processFile(file);
      if (result.success && result.url && result.metadata) {
        onFileUpload(file, result.url, result.metadata);
        setState(prev => ({ ...prev, progress: prev.progress + (100 / droppedFiles.length) }));
      } else {
        onError({ code: 'UPLOAD_FAILED', message: 'Failed to upload file', fileName: file.name });
      }
    }

    setState(prev => ({ ...prev, uploading: false, completed: true }));
  }, [multiple, onError, onFileUpload]);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const selectedFiles = Array.from(event.target.files);
      handleDrop({ preventDefault: () => {}, stopPropagation: () => {}, dataTransfer: { files: event.target.files! }} as any);
    }
  };

  const handleRemoveFile = (index: number) => {
    setState(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  };

  return (
    <Box
      sx={{
        border: '2px dashed',
        borderColor: 'primary.main',
        borderRadius: 2,
        p: 3,
        textAlign: 'center',
        bgcolor: 'background.paper',
        position: 'relative'
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        multiple={multiple}
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />

      {state.uploading ? (
        <Box sx={{ width: '100%' }}>
          <LoadingSpinner size={40} overlay={false} />
          <LinearProgress variant="determinate" value={state.progress} sx={{ mt: 2 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Uploading... {Math.round(state.progress)}%
          </Typography>
        </Box>
      ) : (
        <>
          <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Drag and drop files here
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            or
          </Typography>
          <Button variant="contained" onClick={handleFileSelect}>
            Select Files
          </Button>
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            Supported formats: {acceptedTypes.join(', ')}
          </Typography>
        </>
      )}

      {state.files.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {state.files.map((file, index) => (
            <Box
              key={`${file.name}-${index}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: 1,
                bgcolor: 'background.default',
                borderRadius: 1,
                mb: 1
              }}
            >
              {state.completed ? (
                <CheckCircle color="success" sx={{ mr: 1 }} />
              ) : (
                state.error ? (
                  <Warning color="error" sx={{ mr: 1 }} />
                ) : null
              )}
              <Typography variant="body2" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {file.name}
              </Typography>
              <Tooltip title="Remove file">
                <IconButton size="small" onClick={() => handleRemoveFile(index)}>
                  <Close />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default FileUpload;