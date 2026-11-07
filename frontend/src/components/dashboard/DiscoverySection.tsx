export function DiscoverySection({ onSearch }: { onSearch: () => void }) {
  return <section className="presentation-discovery" id="discover" aria-labelledby="discovery-heading" tabIndex={-1} data-reveal>
    <p className="presentation-eyebrow">07 / Your next move</p>
    <h2 id="discovery-heading">Every great connection<br /><span>starts somewhere.</span></h2>
    <p>Start with a company. Follow a shared connection. Find a more meaningful way to begin the conversation.</p>
    <button className="button button--primary presentation-primary-action" type="button" onClick={onSearch}>Find your next introduction <span aria-hidden="true">↗</span></button>
    <svg className="discovery-network-art" viewBox="0 0 600 450" fill="none" aria-hidden="true"><g stroke="currentColor"><circle cx="440" cy="300" r="170" /><circle cx="440" cy="300" r="245" /><path d="m270 300 170-170 170 170-170 170-170-170m170-170v340m-170-170h340" /></g><g fill="currentColor"><circle cx="270" cy="300" r="4" /><circle cx="440" cy="130" r="5" /><circle cx="440" cy="300" r="6" /></g></svg>
  </section>
}
