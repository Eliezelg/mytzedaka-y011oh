/**
 * Form utility functions for the International Jewish Association Donation Platform
 * Provides comprehensive form handling, validation, error management and data formatting
 * with support for multi-step validation, internationalization, and security measures
 * @version 1.0.0
 */

import { validateEmail, validatePassword, validatePhoneNumber } from './validation.utils';
import * as yup from 'yup'; // v1.2.0

// Types for form validation and error handling
export type ValidationRules<T> = Partial<Record<keyof T, Array<(value: any, formData?: T) => string | undefined>>>;
export type FormErrors = Record<string, string[]>;
export type FormStepValidation = {
  step: number;
  isValid: boolean;
  dependencies: string[];
};

/**
 * Sanitizes input value to prevent XSS attacks
 * @param value - Input value to sanitize
 * @returns Sanitized value
 */
const sanitizeInput = (value: any): any => {
  if (typeof value === 'string') {
    return value.replace(/[<>]/g, '');
  }
  return value;
};

/**
 * Validates a single form field with enhanced security checks and internationalization support
 * @param fieldName - Name of the field to validate
 * @param value - Value to validate
 * @param validationRules - Validation rules object
 * @returns Array of validation error messages
 */
export const validateFormField = <T>(
  fieldName: keyof T,
  value: any,
  validationRules: ValidationRules<T>
): string[] => {
  const errors: string[] = [];
  const sanitizedValue = sanitizeInput(value);
  
  // Skip validation if no rules exist for this field
  if (!validationRules[fieldName]) {
    return errors;
  }

  // Apply each validation rule
  validationRules[fieldName]?.forEach(rule => {
    const error = rule(sanitizedValue);
    if (error) {
      errors.push(error);
    }
  });

  return errors;
};

/**
 * Formats form data before submission with sanitization and type conversion
 * @param formData - Form data object to format
 * @returns Formatted form data
 */
export const formatFormData = <T extends object>(formData: T): T => {
  const formatted = { ...formData };

  Object.entries(formatted).forEach(([key, value]) => {
    if (typeof value === 'string') {
      // Trim whitespace and sanitize string values
      (formatted as any)[key] = sanitizeInput(value.trim());
    } else if (value instanceof Date) {
      // Ensure consistent date format
      (formatted as any)[key] = value.toISOString();
    } else if (typeof value === 'number') {
      // Handle numeric values
      (formatted as any)[key] = Number(value.toFixed(2));
    }
  });

  return formatted;
};

/**
 * Retrieves localized error message for a form field
 * @param fieldName - Name of the field
 * @param errors - Form errors object
 * @returns Localized error message or undefined
 */
export const getFieldError = (
  fieldName: string,
  errors: FormErrors
): string | undefined => {
  return errors[fieldName]?.[0];
};

/**
 * Validates entire form data with support for multi-step validation and field dependencies
 * @param formData - Form data to validate
 * @param validationRules - Validation rules object
 * @param stepConfig - Optional step configuration for multi-step forms
 * @returns Validation result object
 */
export const validateForm = <T extends object>(
  formData: T,
  validationRules: ValidationRules<T>,
  stepConfig?: {
    currentStep: number;
    totalSteps: number;
    stepFields: Record<number, (keyof T)[]>;
  }
): {
  isValid: boolean;
  errors: FormErrors;
  stepValidation?: Record<number, boolean>;
} => {
  const errors: FormErrors = {};
  const stepValidation: Record<number, boolean> = {};

  // Determine fields to validate based on step configuration
  const fieldsToValidate = stepConfig
    ? stepConfig.stepFields[stepConfig.currentStep]
    : Object.keys(validationRules) as (keyof T)[];

  // Validate each field
  fieldsToValidate.forEach(fieldName => {
    const fieldErrors = validateFormField(
      fieldName,
      formData[fieldName],
      validationRules
    );
    if (fieldErrors.length > 0) {
      errors[fieldName as string] = fieldErrors;
    }
  });

  // Calculate step validation status if step config is provided
  if (stepConfig) {
    for (let step = 1; step <= stepConfig.totalSteps; step++) {
      const stepFields = stepConfig.stepFields[step];
      stepValidation[step] = stepFields.every(
        field => !errors[field as string]
      );
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    ...(stepConfig && { stepValidation })
  };
};

/**
 * Creates a validation schema for form data using yup
 * @param schema - Yup schema configuration
 * @returns ValidationRules object
 */
export const createValidationSchema = <T extends object>(
  schema: yup.ObjectSchema<any>
): ValidationRules<T> => {
  const rules: ValidationRules<T> = {};

  Object.keys(schema.fields).forEach(fieldName => {
    rules[fieldName as keyof T] = [
      (value: any) => {
        try {
          schema.validateSyncAt(fieldName, { [fieldName]: value });
          return undefined;
        } catch (error) {
          return (error as yup.ValidationError).message;
        }
      }
    ];
  });

  return rules;
};

/**
 * Handles form auto-save functionality
 * @param formData - Current form data
 * @param formId - Unique identifier for the form
 */
export const autoSaveForm = <T extends object>(
  formData: T,
  formId: string
): void => {
  try {
    localStorage.setItem(
      `form_draft_${formId}`,
      JSON.stringify({
        data: formatFormData(formData),
        timestamp: new Date().toISOString()
      })
    );
  } catch (error) {
    console.error('Error saving form draft:', error);
  }
};

/**
 * Retrieves auto-saved form data
 * @param formId - Unique identifier for the form
 * @returns Saved form data or null
 */
export const getSavedFormData = <T extends object>(
  formId: string
): T | null => {
  try {
    const saved = localStorage.getItem(`form_draft_${formId}`);
    if (saved) {
      const { data } = JSON.parse(saved);
      return data as T;
    }
  } catch (error) {
    console.error('Error retrieving form draft:', error);
  }
  return null;
};