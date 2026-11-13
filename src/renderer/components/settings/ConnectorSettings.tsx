/** Task-source connections (Helix first). Empty for now; connections arrive in a later phase. */
export function ConnectorSettings() {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-foreground">Connectors</h2>
      <p className="text-sm text-muted-foreground">Connect outside task systems (Helix, later Jira, Trello, Lark) to bring tickets into Nakoda.</p>
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No connectors yet.</div>
    </section>
  )
}
