import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--fg, #b8e6ff)',
          background: 'var(--bg, #03090e)',
          fontFamily: 'inherit',
        }}
      >
        <h1 style={{ color: 'var(--theme-accent, #00d4ff)', marginBottom: '0.5rem' }}>
          Something went wrong.
        </h1>
        <p style={{ opacity: 0.85, marginBottom: '1.5rem', maxWidth: '40ch' }}>
          The gallery hit an unexpected error. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            padding: '0.6rem 1.2rem',
            background: 'transparent',
            color: 'var(--theme-accent, #00d4ff)',
            border: '1px solid var(--theme-accent, #00d4ff)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '1rem',
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
