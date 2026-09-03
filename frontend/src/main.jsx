import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import RacingScene from './components/RacingScene/RacingScene.jsx'

// ?view=racing renders the isolated racing scene fullscreen for reviewing it
// on its own. Any other URL renders the normal dashboard, untouched.
const params = new URLSearchParams(window.location.search)
const isRacingView = params.get('view') === 'racing'
const racingDebug = params.get('debug') === '1'

function Root() {
  if (isRacingView) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#05070a' }}>
        <RacingScene debug={racingDebug} />
      </div>
    )
  }
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
