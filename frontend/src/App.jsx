import Header from './components/Header'
import RivalEstimator from './components/RivalEstimator'
import DecisionBanner from './components/DecisionBanner'
import MonteCarloPlanner from './components/MonteCarloPlanner'
import RacingScene from './components/RacingScene/RacingScene'
import CircuitMapPlaceholder from './components/CircuitMapPlaceholder'
import EnergyStatus from './components/EnergyStatus'
import ComplianceProbe from './components/ComplianceProbe'
import OpportunityTimeline from './components/OpportunityTimeline'
import FooterStrip from './components/FooterStrip'
import { DashboardDataProvider } from './services/DashboardDataContext'
import styles from './App.module.css'

/** Three-zone command-room composition: LEFT = why + what (decision chain),
 * CENTER = the car (primary visual subject) with Monte Carlo directly
 * beneath it (both "primary tier" per the layout brief — the car is the
 * headline, Monte Carlo is the strategic validation backing the decision),
 * RIGHT = where (circuit) + when (opportunity timeline). Energy Status and
 * Compliance are deliberately demoted to one slim supporting strip — they
 * are real, useful telemetry, but not what a judge needs to read in the
 * first 2-3 seconds. */
export default function App() {
  return (
    <DashboardDataProvider>
      <AppShell />
    </DashboardDataProvider>
  )
}

function AppShell() {
  return (
    <div className={styles.shell}>
      <Header />

      <div className={styles.dashboard}>
        <div className={styles.mainRow}>
          <div className={styles.leftColumn}>
            <DecisionBanner />
            <RivalEstimator />
          </div>

          <div className={styles.centerColumn}>
            <div className={styles.carArea}>
              <RacingScene />
            </div>
            <MonteCarloPlanner />
          </div>

          <div className={styles.rightColumn}>
            <CircuitMapPlaceholder />
            <OpportunityTimeline />
          </div>
        </div>

        <div className={styles.supportRow}>
          <EnergyStatus />
          <ComplianceProbe compact />
        </div>
      </div>

      <FooterStrip />
    </div>
  )
}
