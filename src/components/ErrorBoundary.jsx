import React from 'react';

/* Catches render-time errors anywhere in the tree and shows a friendly,
   on-brand fallback instead of a blank screen. */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Hook a real logger/Sentry here in production.
    console.error('Cupid hit an error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeContent: 'center',
            textAlign: 'center',
            padding: '60px 24px',
            background: '#1a120b',
            color: '#f5ede1',
          }}
        >
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 30, margin: 0 }}>Something spilled.</h1>
          <p style={{ fontFamily: 'system-ui, sans-serif', opacity: 0.7, marginTop: 12 }}>
            The page hit an unexpected error. A quick refresh should pour a fresh cup.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 22,
              justifySelf: 'center',
              padding: '12px 22px',
              borderRadius: 99,
              border: 'none',
              background: '#c8a97a',
              color: '#231810',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
