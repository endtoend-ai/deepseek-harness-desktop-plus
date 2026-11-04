const bridge = window.dshDesktop?.pluginRecovery
const summary = document.querySelector('#summary')
const operation = document.querySelector('#operation')
const attempt = document.querySelector('#attempt')
const reason = document.querySelector('#reason')
const notice = document.querySelector('#notice')
const retry = document.querySelector('#retry')
const exportButton = document.querySelector('#export')

const reasons = {
  'unsupported-journal-version': 'The recovery journal version is not supported',
  'journal-invalid': 'The recovery journal is invalid',
  'snapshot-missing': 'The previous-environment snapshot is missing',
  'snapshot-invalid': 'The previous-environment snapshot is invalid',
  'snapshot-root-mismatch': 'The snapshot does not belong to the current profile',
  'snapshot-path-invalid': 'The snapshot contains an unsafe path',
  'snapshot-hash-mismatch': 'The snapshot failed its integrity check',
  'profile-lock-busy': 'Another process still holds the plugin environment',
  'host-stop-failed': 'The previous Host could not stop safely',
  'profile-restore-failed': 'Profile files could not be restored',
  'package-restore-failed': 'The previous dependencies could not be restored',
  'host-start-failed': 'The previous Host could not start again',
  'runtime-verification-failed': 'The previous runtime capability check failed',
  'diagnostic-export-failed': 'The diagnostic export failed',
}

let current = null

function render(snapshot) {
  current = snapshot
  if (snapshot === null) {
    summary.textContent = 'No recovery record is readable. Restart the application or contact support.'
    operation.textContent = '—'
    attempt.textContent = '—'
    reason.textContent = 'The recovery record is unavailable'
    retry.disabled = true
    exportButton.disabled = true
    return
  }
  operation.textContent = snapshot.operationId
  attempt.textContent = String(snapshot.attempt)
  reason.textContent = snapshot.recoveryReasonCode === null
    ? '—'
    : reasons[snapshot.recoveryReasonCode] ?? snapshot.recoveryReasonCode
  exportButton.disabled = !snapshot.canExportDiagnostics
  retry.disabled = !snapshot.canRetry
  if (snapshot.phase === 'recovering') {
    summary.textContent = 'Restoring the plugin environment from before the last operation; an incompatible lock file triggers an automatic compatibility retry, so keep the application open.'
  } else if (snapshot.phase === 'recovery-failed') {
    summary.textContent = snapshot.recoveryReasonCode === 'package-restore-failed'
      ? 'The previous dependencies were not restored under either the frozen lock or compatibility mode. Export diagnostics first, then check whether the plugin archive or the network is still reachable.'
      : 'The previous environment did not pass full verification. Retry, or export diagnostics that omit local paths and file contents.'
  } else {
    summary.textContent = 'The previous plugin environment is restored; opening the ordinary desktop.'
  }
}

retry.addEventListener('click', async () => {
  if (bridge === undefined || current === null) return
  retry.disabled = true
  exportButton.disabled = true
  notice.textContent = 'Restoring and verifying the previous environment again; an old lock file is converted automatically when needed…'
  try {
    render(await bridge.retry({ operationId: current.operationId }))
    notice.textContent = current?.phase === 'rolled-back' ? 'Recovery complete.' : 'Recovery still failed; check the new failure reason.'
  } catch {
    notice.textContent = 'The recovery request did not finish. Try again or export diagnostics.'
    retry.disabled = false
    exportButton.disabled = false
  }
})

exportButton.addEventListener('click', async () => {
  if (bridge === undefined || current === null) return
  exportButton.disabled = true
  notice.textContent = 'Choose where to save the diagnostics file…'
  try {
    const result = await bridge.exportDiagnostics({ operationId: current.operationId })
    notice.textContent = result.status === 'saved'
      ? `Diagnostics saved: ${result.filename}`
      : 'Export cancelled.'
  } catch {
    notice.textContent = 'The diagnostic export failed.'
  } finally {
    exportButton.disabled = false
  }
})

if (bridge === undefined) {
  notice.textContent = 'The desktop recovery bridge is unavailable.'
  render(null)
} else {
  bridge.onState(render)
  bridge.getState().then(render, () => {
    notice.textContent = 'The recovery state could not be read.'
    render(null)
  })
}
