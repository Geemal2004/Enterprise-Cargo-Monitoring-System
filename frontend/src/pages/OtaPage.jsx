import OtaPanel from "../components/OtaPanel";

export default function OtaPage() {
  return (
    <main className="page-grid">
      <section>
        <div className="panel-headline spaced-bottom">
          <h2>OTA Updates</h2>
          <p>Upload firmware binaries and trigger updates for gateway and container devices.</p>
        </div>

        <OtaPanel />
      </section>
    </main>
  );
}