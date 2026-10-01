import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected error occurred.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in MyWardrobe AI:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let friendlyMessage = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed && parsed.error) {
          friendlyMessage = `${parsed.error} (Operation: ${parsed.operationType || 'unknown'}, Path: ${parsed.path || 'unknown'})`;
        }
      } catch {
        // Not a JSON FirestoreErrorInfo string
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF8F5] dark:bg-[#11100F] text-stone-900 dark:text-stone-100">
          <div className="max-w-md w-full rounded-2xl bg-white dark:bg-stone-900 p-8 border border-stone-200 dark:border-stone-800 shadow-sm">
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 flex items-center justify-center mb-4">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-display font-semibold mb-2">
              Something interrupted your styling session
            </h1>
            <p className="text-sm text-stone-600 dark:text-stone-400 mb-6 break-words">
              {friendlyMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              className="w-full min-h-[44px] rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
