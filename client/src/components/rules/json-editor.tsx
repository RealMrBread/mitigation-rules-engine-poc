import { useState, useEffect, useRef } from 'react';
import { RuleSchema } from '@shared/schemas/rule.schema.js';

interface JsonEditorProps {
  value: object;
  onChange: (value: object) => void;
}

// ---------------------------------------------------------------------------
// Format Zod errors into readable strings
// ---------------------------------------------------------------------------

function formatZodIssues(issues: Array<{ path: (string | number)[]; message: string }>): string[] {
  return issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `${path}: ${issue.message}`;
  });
}

// ---------------------------------------------------------------------------
// JsonEditor
// ---------------------------------------------------------------------------

export function JsonEditor({ value, onChange }: JsonEditorProps) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [validationResult, setValidationResult] = useState<'valid' | 'invalid' | null>(null);
  const isExternalUpdate = useRef(false);

  // Sync form → JSON when the form value changes externally
  useEffect(() => {
    isExternalUpdate.current = true;
    setText(JSON.stringify(value, null, 2));
    setErrors([]);
    setValidationResult(null);
  }, [value]);

  function handleTextChange(newText: string) {
    setText(newText);
    setValidationResult(null);

    // Try to parse and push to form
    try {
      const parsed = JSON.parse(newText);
      setErrors([]);
      onChange(parsed);
    } catch {
      setErrors(['Invalid JSON syntax']);
    }
  }

  function handleFormat() {
    try {
      const parsed = JSON.parse(text);
      setText(JSON.stringify(parsed, null, 2));
      setErrors([]);
    } catch {
      setErrors(['Cannot format — invalid JSON syntax']);
    }
  }

  function handleValidate() {
    try {
      const parsed = JSON.parse(text);
      const result = RuleSchema.safeParse(parsed);
      if (result.success) {
        setErrors([]);
        setValidationResult('valid');
      } else {
        setErrors(formatZodIssues(result.error.issues));
        setValidationResult('invalid');
      }
    } catch {
      setErrors(['Cannot validate — invalid JSON syntax']);
      setValidationResult('invalid');
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">JSON Definition</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleFormat}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            Format
          </button>
          <button
            type="button"
            onClick={handleValidate}
            className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            Validate
          </button>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        rows={30}
        spellCheck={false}
        className="w-full font-mono text-sm rounded-md border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 resize-y"
      />

      {/* Validation result */}
      {validationResult === 'valid' && errors.length === 0 && (
        <div className="mt-3 rounded-md bg-green-50 border border-green-200 p-3">
          <p className="text-sm text-green-700 font-medium flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Valid rule definition
          </p>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mt-3 rounded-md bg-red-50 border border-red-200 p-3">
          <p className="text-sm font-medium text-red-700 mb-1">
            {errors.length} {errors.length === 1 ? 'error' : 'errors'} found
          </p>
          <ul className="space-y-0.5">
            {errors.map((err, i) => (
              <li key={i} className="text-xs text-red-600 font-mono">
                {err}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
