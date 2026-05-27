import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { ConfidenceBar, IntentChip, StageBadge } from "@/components/atoms";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { LeadStage } from "@/lib/types";
import { useMountedNow } from "@/hooks/use-now";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/leads")({
  head: () => ({
    meta: [
      { title: "Leads — Gharpayy" },
      {
        name: "description",
        content: "Every lead, ranked by deal probability, one click into the control panel.",
      },
    ],
  }),
  component: LeadsPage,
});

const STAGES: { stage: LeadStage; label: string; color: string }[] = [
  { stage: "new", label: "New", color: "border-t-info" },
  { stage: "contacted", label: "Contacted", color: "border-t-muted" },
  { stage: "tour-scheduled", label: "Tour Scheduled", color: "border-t-accent" },
  { stage: "tour-done", label: "Tour Done", color: "border-t-success" },
  { stage: "negotiation", label: "Negotiation", color: "border-t-warning" },
  { stage: "booked", label: "Booked", color: "border-t-emerald-500" },
  { stage: "dropped", label: "Dropped", color: "border-t-slate-400" },
];

function LeadsPage() {
  const { leads, tcms, selectLead, setLeadStage } = useApp();
  const [, mounted] = useMountedNow();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"confidence" | "moveIn" | "updated">("confidence");
  //start
  const [viewMode, setViewMode] = useState<"list" | "pipeline">("pipeline");
  const [isDraggingOver, setIsDraggingOver] = useState<Record<string, boolean>>({});
  //end

  const filtered = useMemo(() => {
    const list = leads.filter((l) => {
      if (q && !l.name.toLowerCase().includes(q.toLowerCase()) && !l.phone.includes(q))
        return false;
      if (stage !== "all" && l.stage !== stage) return false;
      return true;
    });
    list.sort((a, b) => {
      if (sortBy === "confidence") return b.confidence - a.confidence;
      if (sortBy === "moveIn") return +new Date(a.moveInDate) - +new Date(b.moveInDate);
      return +new Date(b.updatedAt) - +new Date(a.updatedAt);
    });
    return list;
  }, [leads, q, stage, sortBy]);

  //start
  // Group leads by stage for the Pipeline View
  const groupedLeads = useMemo(() => {
    const groups: Record<LeadStage, typeof filtered> = {
      new: [],
      contacted: [],
      "tour-scheduled": [],
      "tour-done": [],
      negotiation: [],
      booked: [],
      dropped: [],
    };
    filtered.forEach((l) => {
      if (groups[l.stage]) {
        groups[l.stage].push(l);
      }
    });
    return groups;
  }, [filtered]);

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("text/plain", leadId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent, targetStage: LeadStage) => {
    e.preventDefault();
    setIsDraggingOver((prev) => ({ ...prev, [targetStage]: true }));
  };

  const handleDragLeave = (e: React.DragEvent, targetStage: LeadStage) => {
    e.preventDefault();
    setIsDraggingOver((prev) => ({ ...prev, [targetStage]: false }));
  };

  const handleDrop = (e: React.DragEvent, targetStage: LeadStage) => {
    e.preventDefault();
    setIsDraggingOver((prev) => ({ ...prev, [targetStage]: false }));
    const leadId = e.dataTransfer.getData("text/plain");
    if (leadId) {
      const lead = leads.find((l) => l.id === leadId);
      if (lead) {
        if (lead.stage !== targetStage) {
          setLeadStage(leadId, targetStage);
          toast.success(`Moved ${lead.name} to ${targetStage.replace("-", " ")}`);
        }
      }
    }
  };
  //end

  return (
    <AppShell>
      <div className="space-y-4">
        <header className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Leads</h1>
            <p className="text-sm text-muted-foreground">
              {filtered.length} of {leads.length} · ranked by deal probability
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* start */}
            <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/40">
              <button
                onClick={() => setViewMode("pipeline")}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  viewMode === "pipeline"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Pipeline Board"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  viewMode === "list"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="List View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            {/* end */}
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or phone…"
              className="h-9 w-56 text-sm bg-card border-border"
            />
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="h-9 w-44 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {(
                  [
                    "new",
                    "contacted",
                    "tour-scheduled",
                    "tour-done",
                    "negotiation",
                    "booked",
                    "dropped",
                  ] as LeadStage[]
                ).map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s.replace("-", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: string) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="h-9 w-44 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confidence">Sort: Confidence</SelectItem>
                <SelectItem value="moveIn">Sort: Move-in date</SelectItem>
                <SelectItem value="updated">Sort: Last updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* start */}
        {viewMode === "list" ? (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border bg-muted/40">
              <div className="col-span-3">Lead</div>
              <div className="col-span-2">Stage</div>
              <div className="col-span-2">Intent · score</div>
              <div className="col-span-2">Area · budget</div>
              <div className="col-span-2">Assigned</div>
              <div className="col-span-1 text-right">Updated</div>
            </div>
            <div className="divide-y divide-border">
              {filtered.map((l) => {
                const tcm = tcms.find((t) => t.id === l.assignedTcmId);
                return (
                  <div key={l.id}>
                    <button
                      onClick={() => selectLead(l.id)}
                      className="w-full text-left grid grid-cols-12 px-4 py-3 items-center hover:bg-accent/5 transition-colors"
                    >
                      <div className="col-span-3">
                        <div className="font-medium text-sm">{l.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {l.phone} · {l.source}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <StageBadge stage={l.stage} />
                      </div>
                      <div className="col-span-2 flex items-center gap-2">
                        <IntentChip intent={l.intent} />
                        <ConfidenceBar value={l.confidence} />
                      </div>
                      <div className="col-span-2 text-xs">
                        <div>{l.preferredArea}</div>
                        <div className="text-muted-foreground">
                          ₹{(l.budget / 1000).toFixed(0)}k
                        </div>
                      </div>
                      <div className="col-span-2 text-xs">
                        <div>{tcm?.name ?? "—"}</div>
                        <div className="text-muted-foreground">{tcm?.zone ?? "—"}</div>
                      </div>
                      <div className="col-span-1 text-right text-[11px] text-muted-foreground">
                        {mounted
                          ? formatDistanceToNow(new Date(l.updatedAt), { addSuffix: true })
                          : "—"}
                      </div>
                    </button>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No leads match.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin select-none snap-x snap-mandatory min-h-[calc(100vh-220px)]">
            {STAGES.map(({ stage: st, label, color }) => {
              const stageLeads = groupedLeads[st] || [];
              const isOver = !!isDraggingOver[st];
              return (
                <div
                  key={st}
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnter(e, st)}
                  onDragLeave={(e) => handleDragLeave(e, st)}
                  onDrop={(e) => handleDrop(e, st)}
                  className={cn(
                    "flex-1 min-w-[280px] max-w-[340px] rounded-xl border bg-card/45 backdrop-blur-sm p-3 flex flex-col h-[calc(100vh-230px)] transition-all snap-start",
                    isOver ? "border-accent bg-accent/5 ring-1 ring-accent" : "border-border",
                    color,
                    "border-t-2",
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-foreground/80 flex items-center gap-1.5">
                      <span>{label}</span>
                      <span className="rounded-full bg-muted/80 text-[10px] px-1.5 py-0.2 font-mono text-muted-foreground">
                        {stageLeads.length}
                      </span>
                    </h3>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                    {stageLeads.map((l) => {
                      const tcm = tcms.find((t) => t.id === l.assignedTcmId);
                      return (
                        <div
                          key={l.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, l.id)}
                          onClick={() => selectLead(l.id)}
                          className={cn(
                            "rounded-lg border border-border/80 bg-card/85 p-3 space-y-2 shadow-sm hover:border-accent/40 hover:shadow-md transition-all cursor-grab active:cursor-grabbing",
                            l.intent === "hot" && "border-l-2 border-l-destructive",
                            l.intent === "warm" && "border-l-2 border-l-warning",
                          )}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0">
                              <h4 className="font-medium text-xs text-foreground truncate hover:text-accent transition-colors">
                                {l.name}
                              </h4>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {l.preferredArea} · via {l.source}
                              </p>
                            </div>
                            <span className="text-[10px] font-semibold text-foreground/80 shrink-0">
                              ₹{(l.budget / 1000).toFixed(0)}k
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-1.5 flex-wrap">
                            <IntentChip intent={l.intent} className="text-[9px] px-1 py-0" />
                            <ConfidenceBar value={l.confidence} />
                          </div>

                          <div className="flex items-center justify-between text-[9px] text-muted-foreground border-t border-border/40 pt-1.5 mt-1.5">
                            <div
                              className="flex items-center gap-1 truncate"
                              title={tcm?.name ?? "Unassigned"}
                            >
                              <div className="h-4 w-4 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-[8px] font-bold text-accent shrink-0">
                                {tcm?.initials ?? "U"}
                              </div>
                              <span className="truncate">
                                {tcm?.name.split(" ")[0] ?? "Unassigned"}
                              </span>
                            </div>
                            <span className="tabular-nums whitespace-nowrap">
                              {mounted
                                ? formatDistanceToNow(new Date(l.updatedAt), { addSuffix: false })
                                : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {stageLeads.length === 0 && (
                      <div className="h-24 border border-dashed border-border/60 rounded-lg flex items-center justify-center text-[10px] text-muted-foreground/60 text-center p-4">
                        Drag leads here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* end */}
      </div>
    </AppShell>
  );
}
