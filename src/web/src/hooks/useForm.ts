import { useState, useCallback, useEffect, FormEvent, ChangeEvent, FocusEvent } from 'react'; // v18.2.0
import { debounce } from 'lodash'; // v4.17.21
import { validateFormField, formatFormData } from '../utils/form.utils';

// Types for form management
type UseFormOptions = {
  enableAutosave?: boolean;
  autosaveInterval?: number;
  enableDraftManagement?: boolean;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  locale?: string;
};

type ValidationRules<T> = Partial<Record<keyof T, Array<(value: any, locale: string) => string | undefined>>>;

type UseFormReturn<T> = {
  values: T;
  errors: Record<string, string[]>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
  locale: string;
  isRTL: boolean;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleBlur: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleSubmit: (e: FormEvent) => Promise<void>;
  setFieldValue: (field: keyof T, value: any) => void;
  resetForm: () => void;
  saveDraft: () => void;
  loadDraft: () => void;
};

const DRAFT_STORAGE_PREFIX = 'form_draft_';
const RTL_LOCALES = ['he', 'ar'];
const DEFAULT_AUTOSAVE_INTERVAL = 30000; // 30 seconds

/**
 * Advanced form management hook with multi-language support and enhanced validation
 * @param initialValues - Initial form values
 * @param validationRules - Form validation rules
 * @param onSubmit - Form submission handler
 * @param options - Form configuration options
 */
const useForm = <T extends object>(
  initialValues: T,
  validationRules: ValidationRules<T>,
  onSubmit: (data: T) => Promise<void>,
  options: UseFormOptions = {}
): UseFormReturn<T> => {
  // Destructure options with defaults
  const {
    enableAutosave = false,
    autosaveInterval = DEFAULT_AUTOSAVE_INTERVAL,
    enableDraftManagement = false,
    validateOnChange = true,
    validateOnBlur = true,
    locale = 'en'
  } = options;

  // Initialize form state
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isValid, setIsValid] = useState(true);

  // Determine RTL based on locale
  const isRTL = RTL_LOCALES.includes(locale);

  // Create unique form identifier for draft management
  const formId = JSON.stringify(initialValues);

  // Debounced validation function
  const debouncedValidate = useCallback(
    debounce((fieldName: keyof T, value: any) => {
      const fieldErrors = validateFormField(fieldName, value, validationRules, locale);
      setErrors(prev => ({
        ...prev,
        [fieldName]: fieldErrors
      }));
      setIsValid(Object.values(errors).every(fieldErrors => fieldErrors.length === 0));
    }, 300),
    [validationRules, locale]
  );

  // Handle form field changes
  const handleChange = useCallback((
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const fieldValue = type === 'number' ? parseFloat(value) : value;

    setValues(prev => ({
      ...prev,
      [name]: fieldValue
    }));
    setIsDirty(true);

    if (validateOnChange) {
      debouncedValidate(name as keyof T, fieldValue);
    }
  }, [validateOnChange, debouncedValidate]);

  // Handle field blur events
  const handleBlur = useCallback((
    e: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name } = e.target;
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));

    if (validateOnBlur) {
      debouncedValidate(name as keyof T, values[name as keyof T]);
    }
  }, [validateOnBlur, values, debouncedValidate]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validate all fields before submission
    const allErrors: Record<string, string[]> = {};
    Object.keys(values).forEach(key => {
      const fieldErrors = validateFormField(key as keyof T, values[key as keyof T], validationRules, locale);
      if (fieldErrors.length > 0) {
        allErrors[key] = fieldErrors;
      }
    });

    setErrors(allErrors);
    const hasErrors = Object.keys(allErrors).length > 0;
    setIsValid(!hasErrors);

    if (!hasErrors) {
      try {
        const formattedData = formatFormData(values, locale);
        await onSubmit(formattedData);
        setIsDirty(false);
        if (enableDraftManagement) {
          localStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${formId}`);
        }
      } catch (error) {
        console.error('Form submission error:', error);
      }
    }
    setIsSubmitting(false);
  }, [values, validationRules, locale, onSubmit, formId, enableDraftManagement]);

  // Set individual field value
  const setFieldValue = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({
      ...prev,
      [field]: value
    }));
    setIsDirty(true);
    if (validateOnChange) {
      debouncedValidate(field, value);
    }
  }, [validateOnChange, debouncedValidate]);

  // Reset form to initial state
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsDirty(false);
    setIsValid(true);
    if (enableDraftManagement) {
      localStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${formId}`);
    }
  }, [initialValues, enableDraftManagement, formId]);

  // Save form draft
  const saveDraft = useCallback(() => {
    if (enableDraftManagement && isDirty) {
      try {
        localStorage.setItem(
          `${DRAFT_STORAGE_PREFIX}${formId}`,
          JSON.stringify({
            values,
            timestamp: new Date().toISOString()
          })
        );
      } catch (error) {
        console.error('Error saving form draft:', error);
      }
    }
  }, [enableDraftManagement, isDirty, values, formId]);

  // Load saved draft
  const loadDraft = useCallback(() => {
    if (enableDraftManagement) {
      try {
        const saved = localStorage.getItem(`${DRAFT_STORAGE_PREFIX}${formId}`);
        if (saved) {
          const { values: savedValues } = JSON.parse(saved);
          setValues(savedValues);
          setIsDirty(true);
        }
      } catch (error) {
        console.error('Error loading form draft:', error);
      }
    }
  }, [enableDraftManagement, formId]);

  // Setup autosave
  useEffect(() => {
    if (enableAutosave && isDirty) {
      const interval = setInterval(saveDraft, autosaveInterval);
      return () => clearInterval(interval);
    }
  }, [enableAutosave, isDirty, autosaveInterval, saveDraft]);

  // Load draft on mount if enabled
  useEffect(() => {
    if (enableDraftManagement) {
      loadDraft();
    }
  }, [enableDraftManagement, loadDraft]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isDirty,
    isValid,
    locale,
    isRTL,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    resetForm,
    saveDraft,
    loadDraft
  };
};

export default useForm;