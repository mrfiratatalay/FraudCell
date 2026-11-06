import { RotateCcw } from 'lucide-react';

/** Small badge on every page of the demo build: says it is a demo and resets the data. */
export default function DemoBar() {
  function reset() {
    try {
      localStorage.removeItem('fc-demo-db-v1');
    } catch {
      // Storage blocked: a reload still starts from the seed.
    }
    window.location.assign('/auth');
  }

  return (
    <div
      role="note"
      className="fixed right-3 bottom-[76px] z-[70] flex items-center gap-2 rounded-full bg-night-900/95 py-1 pr-1 pl-3 text-xs text-white/85 shadow-overlay ring-1 ring-white/10 backdrop-blur lg:right-4 lg:bottom-4"
    >
      <span title="Backend yok; veriler bu tarayıcıda tutulur.">
        <strong className="font-semibold text-tc-500">Demo</strong>
        <span className="hidden sm:inline"> · veriler tarayıcında</span>
      </span>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 font-medium text-white hover:bg-white/20"
      >
        <RotateCcw className="size-3" aria-hidden />
        Demoyu sıfırla
      </button>
    </div>
  );
}
