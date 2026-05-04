import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', this.props.name || 'unknown', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
          <AlertTriangle size={48} className="text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">
            {this.props.name ? `${this.props.name} failed to load` : 'Something went wrong'}
          </h3>
          <p className="text-sm text-slate-500 mb-4 max-w-md">
            This section encountered an error. The rest of the app is unaffected.
          </p>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition"
          >
            <RefreshCw size={14} />
            Try Again
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg max-w-lg overflow-auto text-left">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
