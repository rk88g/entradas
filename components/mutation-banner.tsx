import { MutationState } from "@/lib/types";

export function MutationBanner({ state }: { state: MutationState }) {
  if (state.error) {
    return (
      <div className="alert-box">
        <p className="mini-copy">{state.error}</p>
      </div>
    );
  }

  if (state.success) {
    return (
      <div className="note-box">
        <p className="mini-copy">{state.success}</p>
      </div>
    );
  }

  return null;
}

