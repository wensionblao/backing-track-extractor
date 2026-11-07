import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/sora/400.css'
import '@fontsource/sora/500.css'
import '@fontsource/sora/600.css'
import '@fontsource/sora/700.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import App from './App'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="boot">
          <span className="boot-mark">STEMS</span>
          <span className="boot-text">页面加载失败：{this.state.error.message}</span>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
