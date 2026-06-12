import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  name?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary caught an error in ${this.props.name || 'Component'}:`, error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div style={{
          padding: 20,
          background: 'rgba(243, 139, 168, 0.1)',
          border: '1px dashed var(--app-red)',
          borderRadius: 8,
          color: 'var(--app-red)',
          margin: 10,
          fontFamily: 'system-ui, sans-serif'
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontWeight: 600 }}>Something went wrong in {this.props.name || 'this panel'}.</h4>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>{this.state.error?.message}</p>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
