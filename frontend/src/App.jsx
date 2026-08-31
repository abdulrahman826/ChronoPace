import DecisionBanner from './components/DecisionBanner'
import ComplianceProbe from './components/ComplianceProbe'
import MonteCarloPlanner from './components/MonteCarloPlanner'
import RivalEstimator from './components/RivalEstimator'
import TelemetryHeader from './components/TelemetryHeader'
import Viewport3D from './components/Viewport3D'
import styles from './App.module.css'

export default function App() {
  return (
    <>
      <div className={styles.pageTitle}>
        CHRONO<span>PACE</span>
      </div>

      <div className={styles.dashboard}>
        <div className={styles.leftColumn}>
          <DecisionBanner />
          <div className={styles.leftSubGrid}>
            <ComplianceProbe />
            <MonteCarloPlanner />
          </div>
          <RivalEstimator />
        </div>

        <div className={styles.rightColumn}>
          <TelemetryHeader />
          <Viewport3D />
        </div>
      </div>
    </>
  )
}
