import EvidenceBadge from "@/components/EvidenceBadge";
import type { GeneExpressionTableResponse } from "@/types/api";

/**
 * The one place in this project that names specific genes -- real,
 * published measurements from a single NASA-funded study (NAG9-1024 /
 * Burns et al. 2002), not a prediction for an arbitrary dose or crew
 * member. See backend/app/domain/gene_expression_table.py for exactly
 * where every number comes from (the paper's own Table 1).
 */
export default function GeneExpressionTable({ data }: { data: GeneExpressionTableResponse }) {
  return (
    <section className="panel p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Specific genes affected by radiation</h2>
          <p className="mt-1 text-xs text-[var(--faint)]">
            Real measurements from one published, NASA-funded study -- {data.organism}, {data.tissue},{" "}
            {data.radiation_condition}, measured {data.timepoint}.
          </p>
        </div>
        <EvidenceBadge level="data_supported_association" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-[var(--faint)]" style={{ borderColor: "var(--border)" }}>
              <th className="py-2 pr-3">Gene</th>
              <th className="py-2 pr-3">Fold change at 9 Gy</th>
              <th className="py-2 pr-3">Vitamin A reduces the effect?</th>
              <th className="py-2 pr-3">Pattern</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
            {data.records.map((r) => (
              <tr key={r.accession}>
                <td className="py-2.5 pr-3">
                  <div className="font-medium">{r.gene_symbol}</div>
                  <div className="text-xs text-[var(--faint)]">
                    {r.accession} · {r.gene_description}
                  </div>
                </td>
                <td className="py-2.5 pr-3 font-mono text-sm">
                  {r.fold_change_9gy_vs_control != null ? `${r.fold_change_9gy_vs_control}×` : "induced (not detected in control)"}
                </td>
                <td className="py-2.5 pr-3">
                  {r.vitamin_a_reduced_the_9gy_effect ? (
                    <span style={{ color: "var(--tone-emerald)" }}>Yes</span>
                  ) : (
                    <span className="text-[var(--faint)]">No</span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-xs text-[var(--faint)]">
                  {r.category === "reversal_response" ? "Reversal response" : "Additive response"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg border px-3 py-2.5 text-xs text-[var(--muted)]" style={{ borderColor: "var(--border)" }}>
        <p className="mb-1 font-medium">{data.study_citation}</p>
        <ul className="list-inside list-disc">
          {data.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
