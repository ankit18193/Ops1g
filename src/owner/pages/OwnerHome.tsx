import { useMemo, useState, useEffect } from "react";
import { useOwner } from "@/owner/owner-context";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Camera,
  Inbox,
  BarChart3,
  Clock,
  Trophy,
  CheckCircle2,
  Sparkles,
  Activity,
  TrendingUp,
  Wallet,
  Calendar,
  XCircle,
} from "lucide-react";
import { useMountedNow } from "@/hooks/use-now";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/owner/components/Countdown";
import { ownerTier, roomHeroClass } from "@/owner/components/room-hero";
import { OBJECTION_LABELS } from "@/owner/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CoachInline } from "@/components/CoachInline";
import { useApp } from "@/lib/store";

export function OwnerHome() {
  const {
    currentOwnerId,
    setCurrentOwnerId,
    owners,
    complianceFor,
    roomStatuses,
    blocks,
    insights,
    truth,
    properties,
    rooms,
    objections,
    violations,
    decideBlock,
    updateRoomStatus,
  } = useOwner();
  const owner = owners.find((o) => o.id === currentOwnerId) ?? owners[0];
  const compliance = complianceFor(owner.id);
  const myStatuses = roomStatuses.filter((r) => r.ownerId === owner.id);
  const myProps = properties.filter((p) => owner.propertyIds.includes(p.id));
  const myRooms = rooms.filter((r) => myProps.some((p) => p.id === r.propertyId));
  const verified = myStatuses.filter((r) => r.verifiedToday).length;
  const locked = myStatuses.filter((r) => r.lockedUnsellable).length;
  const dedicated = myStatuses.filter((r) => r.isDedicated).length;
  const sellable = myStatuses.filter(
    (r) => r.verifiedToday && !r.lockedUnsellable && (r.kind === "vacant" || r.kind === "vacating"),
  ).length;
  const pendingBlocks = blocks.filter((b) => b.ownerId === owner.id && b.state === "pending");
  const insight = insights.find((i) => i.ownerId === owner.id);
  const myObjections = objections.filter((o) => o.ownerId === owner.id);
  const [, mounted] = useMountedNow(60_000);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (truth.phase === "locked") {
      setSecondsLeft(0);
      return;
    }
    const targetTime = Date.now() + truth.msToNextTransition;
    const updateTimer = () => {
      setSecondsLeft(Math.max(0, Math.floor((targetTime - Date.now()) / 1000)));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [truth]);

  const formatTimeRemaining = (totalSecs: number) => {
    if (totalSecs <= 0) return "00:00:00";
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };
  const tier = ownerTier(compliance.score);
  const appLeads = useApp((s) => s.leads);
  const appTours = useApp((s) => s.tours);
  const ownerAreaText = myProps
    .map((p) => `${p.name} ${p.area}`)
    .join(" ")
    .toLowerCase();
  const matchingLeads = appLeads.filter(
    (l) =>
      ownerAreaText.includes((l.preferredArea || "").toLowerCase()) ||
      ownerAreaText.includes((l.tags?.[0] || "").toLowerCase()),
  );
  const activeVisits = appTours.filter(
    (t) => myProps.some((p) => p.id === t.propertyId) && t.status === "scheduled",
  );
  const hotDemand = matchingLeads.filter((l) => l.intent === "hot").length;
  const ownerActions = [
    pendingBlocks.length
      ? `${pendingBlocks.length} block approval${pendingBlocks.length > 1 ? "s" : ""} waiting`
      : null,
    locked ? `${locked} locked room${locked > 1 ? "s" : ""} need verification` : null,
    compliance.mediaFreshRooms < compliance.totalRooms
      ? `${compliance.totalRooms - compliance.mediaFreshRooms} room photo set${compliance.totalRooms - compliance.mediaFreshRooms > 1 ? "s" : ""} stale`
      : null,
    activeVisits.length
      ? `${activeVisits.length} Tour${activeVisits.length > 1 ? "s" : ""} scheduled by TCM`
      : null,
  ].filter(Boolean) as string[];

  // Revenue lens
  const revenue = useMemo(() => {
    const occupiedRooms = myStatuses.filter((s) => s.kind === "occupied");
    const filledBeds = occupiedRooms.reduce((acc, s) => {
      const r = myRooms.find((x) => x.id === s.roomId);
      return acc + (r?.bedsOccupied ?? 0);
    }, 0);
    const totalBeds = myRooms.reduce((acc, r) => acc + r.bedsTotal, 0);
    const validRents = myStatuses.map((s) => s.rentConfirmed).filter((x): x is number => !!x);
    const avgRent = validRents.length
      ? Math.round(validRents.reduce((a, b) => a + b, 0) / validRents.length)
      : 0;
    const monthly = occupiedRooms.reduce((acc, s) => acc + (s.rentConfirmed ?? 0), 0);
    const vacant = myStatuses.filter((s) => s.kind === "vacant").length;
    return { filledBeds, totalBeds, avgRent, monthly, vacant };
  }, [myStatuses, myRooms]);

  // Demand bars
  const demandBars = useMemo(() => {
    const c: Record<string, number> = {};
    myObjections.forEach((o) => {
      c[o.reason] = (c[o.reason] ?? 0) + 1;
    });
    return c;
  }, [myObjections]);

  // Vacancy forecast
  const forecast = useMemo(() => {
    const map: Record<string, typeof myStatuses> = {};
    myStatuses.forEach((s) => {
      if (s.vacatingDate) {
        map[s.vacatingDate] = map[s.vacatingDate] || [];
        map[s.vacatingDate].push(s);
      }
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [myStatuses]);

  const phaseColor =
    truth.phase === "locked"
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : truth.phase === "warning"
        ? "bg-warning/15 text-warning-foreground border-warning/30"
        : truth.phase === "open"
          ? "bg-info/10 text-info border-info/30"
          : "bg-muted text-muted-foreground border-border";

  return (
    <div className="space-y-6 pb-12">
      {/* OWNER SWITCHER — compact identity control */}
      <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 opacity-80">
        {owners.map((o) => {
          const active = o.id === owner.id;
          return (
            <button
              key={o.id}
              onClick={() => setCurrentOwnerId(o.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] whitespace-nowrap transition-colors",
                active
                  ? "border-warning/50 bg-warning/10 text-warning-foreground"
                  : "border-border bg-card hover:bg-muted text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  o.tier === "priority"
                    ? "bg-success"
                    : o.tier === "throttled"
                      ? "bg-destructive"
                      : "bg-info",
                )}
              />
              {o.name}
            </button>
          );
        })}
      </div>

      <CoachInline page="owner" />

      {/* HERO */}
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
            Welcome back, {owner.name.split(" ")[0]}
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
            Your inventory, your control.
          </h1>
          <p className="text-sm text-muted-foreground">
            Fill your beds without losing control.
            {pendingBlocks.length > 0 && (
              <span className="text-warning-foreground font-medium">
                {" "}
                · {pendingBlocks.length} request{pendingBlocks.length > 1 ? "s" : ""} need your
                call.
              </span>
            )}
          </p>
        </div>
        <div
          className={cn(
            "text-[11px] font-mono inline-flex items-center gap-2 rounded-md border px-2.5 py-1 transition-all duration-300",
            truth.phase === "warning" &&
              "animate-pulse border-destructive bg-destructive/10 text-destructive font-bold",
            phaseColor,
          )}
        >
          <Clock
            className={cn("h-3 w-3", truth.phase === "warning" && "text-destructive animate-spin")}
          />
          <span>
            {truth.phase === "idle" && "Update window opens 9:30 AM"}
            {truth.phase === "open" && "OPEN — update all rooms"}
            {truth.phase === "warning" && "WARNING — auto-lock at 11 AM"}
            {truth.phase === "locked" && "LOCKED — unverified rooms removed from supply"}
          </span>
          {/* start */}
          {secondsLeft > 0 && (
            <span className="font-bold border-l border-current pl-2 tabular-nums">
              {formatTimeRemaining(secondsLeft)}
            </span>
          )}
          {/* end */}
        </div>
      </header>

      {/* TRUST TIER + COMPLIANCE — premium band */}
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div
          className={cn(
            "h-2 w-full",
            tier.tone === "success" && "bg-gradient-to-r from-emerald-400 to-teal-500",
            tier.tone === "warning" && "bg-gradient-to-r from-amber-400 to-orange-500",
            tier.tone === "muted" && "bg-muted",
          )}
        />
        <div className="p-5 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "h-14 w-14 rounded-2xl grid place-items-center text-white shadow-sm",
                tier.tone === "success" && "bg-gradient-to-br from-emerald-400 to-teal-500",
                tier.tone === "warning" && "bg-gradient-to-br from-amber-400 to-orange-500",
                tier.tone === "muted" && "bg-muted text-muted-foreground",
              )}
            >
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                Priority tier
              </div>
              <div className="text-2xl font-display font-semibold">{tier.tier}</div>
              <div className="text-[11px] text-muted-foreground">
                Higher tier = more leads routed to you
              </div>
            </div>
          </div>
          <div className="hidden sm:block h-12 w-px bg-border" />
          <div className="flex items-center gap-5 flex-wrap flex-1 min-w-[280px]">
            {/* start */}
            {(() => {
              const radius = 28;
              const strokeWidth = 5;
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference - (compliance.score / 100) * circumference;
              const strokeColor =
                compliance.score >= 80
                  ? "stroke-success"
                  : compliance.score >= 50
                    ? "stroke-warning"
                    : "stroke-destructive";
              return (
                <div className="relative h-16 w-16 shrink-0 flex items-center justify-center">
                  <svg className="h-full w-full -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r={radius}
                      className="stroke-muted fill-none"
                      strokeWidth={strokeWidth}
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r={radius}
                      className={cn("fill-none transition-all duration-1000 ease-out", strokeColor)}
                      strokeWidth={strokeWidth}
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                    <span className="font-display text-base font-bold text-foreground">
                      {compliance.score}
                    </span>
                    <span className="text-[8px] text-muted-foreground font-semibold">Score</span>
                  </div>
                </div>
              );
            })()}
            {/* end */}

            <div className="flex-1 min-w-[180px] space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                Trust compliance status
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                    compliance.score >= 80
                      ? "bg-success/15 text-success border border-success/30"
                      : compliance.score >= 50
                        ? "bg-warning/15 text-warning-foreground border border-warning/30"
                        : "bg-destructive/15 text-destructive border border-destructive/30",
                  )}
                >
                  {compliance.score >= 80
                    ? "Excellent"
                    : compliance.score >= 50
                      ? "Needs Care"
                      : "Critical Breach"}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">today</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {dedicated} dedicated · {compliance.totalRooms} total rooms ·{" "}
                {compliance.mediaFreshRooms} fresh media
              </div>
            </div>
          </div>
          {violations > 0 && (
            <div className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <div className="text-xs font-mono font-semibold">
                {violations} violation{violations > 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* OPERATING ALIGNMENT — Flow Ops + TCM signal */}
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
              Flow Ops + TCM need from you
            </div>
            <h2 className="font-display text-lg font-semibold">Keep sellable supply clean.</h2>
          </div>
          <div className="flex gap-2 text-[10px] flex-wrap">
            <span className="rounded-full bg-success/10 text-success px-2 py-1">
              {hotDemand} hot leads nearby
            </span>
            <span className="rounded-full bg-info/10 text-info px-2 py-1">
              {activeVisits.length} scheduled Tours
            </span>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {(ownerActions.length
            ? ownerActions
            : ["No blockers. Your rooms are usable by the team."]
          ).map((a, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm flex items-center gap-2"
            >
              <Activity className="h-4 w-4 text-accent" />
              <span>{a}</span>
            </div>
          ))}
        </div>
      </section>

      {/* QUICK STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={CheckCircle2}
          label="Sellable"
          value={sellable}
          sub="Live to team"
          tone="success"
        />
        <StatCard
          icon={Sparkles}
          label="Dedicated"
          value={dedicated}
          sub="Auto-bookable"
          tone="info"
        />
        <StatCard icon={Lock} label="Locked" value={locked} sub="Need confirm" tone="danger" />
        <StatCard
          icon={Clock}
          label="Pending"
          value={pendingBlocks.length}
          sub="Owner approvals"
          tone="warning"
        />
      </div>

      {/* PENDING BLOCKS — top priority, inline */}
      {pendingBlocks.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            icon={Inbox}
            title="Pending block requests"
            subtitle="Approve or reject — auto-released after 15 min"
            tone="warning"
          />
          <div className="space-y-2">
            {pendingBlocks.map((req) => {
              const room = myRooms.find((r) => r.id === req.roomId);
              const prop = properties.find((p) => p.id === req.propertyId);
              const heroId = room?.id ?? req.roomId;
              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-warning/30 bg-card p-3 flex flex-wrap items-center gap-3"
                >
                  <div
                    className={cn(
                      "h-12 w-12 rounded-xl grid place-items-center text-white font-mono font-bold text-xs shadow-sm",
                      roomHeroClass(heroId),
                    )}
                  >
                    {(prop?.name ?? "R").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <div className="text-sm font-semibold">
                      {req.leadName}{" "}
                      <span className="text-muted-foreground font-normal">
                        · intent {req.intent}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      {prop?.name ?? "Room"} · {room?.type ?? "room"} ({room?.bedsTotal ?? "—"}{" "}
                      beds)
                    </div>
                    <div className="text-[11px] mt-1 inline-flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-warning-foreground" />
                      Auto-expires in <Countdown to={req.expiresAt} />
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 sm:flex-initial"
                      onClick={() => {
                        decideBlock(req.id, "rejected");
                        toast.error("Block rejected", { description: `${req.leadName} released.` });
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 sm:flex-initial"
                      onClick={() => {
                        decideBlock(req.id, "approved");
                        toast.success("Block approved", {
                          description: `Locked for ${req.leadName}.`,
                        });
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TODAY CHECKLIST */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ChecklistTile
          to="/owner/rooms"
          icon={Building2}
          label="Update rooms"
          subtitle={
            truth.phase === "locked"
              ? `${locked} locked — fix now`
              : `${myStatuses.length - verified} pending`
          }
          accent={
            truth.phase === "locked"
              ? "destructive"
              : verified === myStatuses.length
                ? "success"
                : "warning"
          }
        />
        <ChecklistTile
          to="/owner/blocks"
          icon={Inbox}
          label="Block requests"
          subtitle={pendingBlocks.length ? `${pendingBlocks.length} need response` : "Inbox zero"}
          accent={pendingBlocks.length ? "warning" : "success"}
        />
        <ChecklistTile
          to="/owner/visits"
          icon={Camera}
          label="Visits today"
          subtitle="Live tour activity"
          accent="default"
        />
      </div>

      {/* start */}
      {/* PENDING ROOM VERIFICATIONS */}
      {myStatuses.filter((r) => !r.verifiedToday).length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            icon={Building2}
            title="Unverified Room Checklist"
            subtitle="Confirm status to keep these rooms sellable"
            tone={truth.phase === "warning" || truth.phase === "locked" ? "warning" : undefined}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myStatuses
              .filter((r) => !r.verifiedToday)
              .map((status) => {
                const roomObj = myRooms.find((x) => x.id === status.roomId);
                const propObj = myProps.find((x) => x.id === status.propertyId);
                return (
                  <div
                    key={status.roomId}
                    className="rounded-xl border border-border bg-card p-3.5 space-y-3 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{propObj?.name}</div>
                        <div className="text-[11px] text-muted-foreground capitalize font-mono">
                          {roomObj?.type} sharing · {status.kind}
                        </div>
                      </div>
                      {status.lockedUnsellable && (
                        <span className="rounded bg-destructive/10 text-destructive text-[9px] font-bold px-1.5 py-0.5 inline-flex items-center gap-1">
                          <Lock className="h-2.5 w-2.5" /> Locked
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs border-t border-border/40 pt-2.5 mt-2">
                      <span className="font-medium text-foreground">
                        ₹{status.rentConfirmed?.toLocaleString() || "—"}/mo
                      </span>
                      <Button
                        size="sm"
                        className="h-7 text-[10px] bg-success hover:bg-success/90 text-success-foreground px-2 py-0"
                        onClick={() => {
                          updateRoomStatus(status.roomId, { verifiedToday: true });
                          toast.success(`Verified ${propObj?.name} ${roomObj?.type}`);
                        }}
                      >
                        Verify Vacancy
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}
      {/* end */}

      {/* REVENUE LENS */}
      <section className="space-y-3">
        <SectionHeader icon={Wallet} title="Revenue lens" subtitle="Cash flow at a glance" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <RevTile label="Filled beds" value={`${revenue.filledBeds}/${revenue.totalBeds}`} />
          <RevTile label="Avg rent" value={`₹${revenue.avgRent.toLocaleString()}`} />
          <RevTile label="Vacant rooms" value={revenue.vacant} tone="warning" />
          <RevTile
            label="Monthly revenue"
            value={`₹${revenue.monthly.toLocaleString()}`}
            tone="success"
          />
        </div>
      </section>

      {/* OWNER ACTION QUEUE */}
      <section className="space-y-3">
        <SectionHeader
          icon={Activity}
          title="Owner action queue"
          subtitle="Specific actions that unblock Flow Ops and TCM"
        />
        <div className="grid md:grid-cols-3 gap-3">
          <ChecklistTile
            to="/owner/blocks"
            icon={Inbox}
            label="Approve / reject holds"
            subtitle={
              pendingBlocks.length ? `${pendingBlocks.length} waiting now` : "No pending holds"
            }
            accent={pendingBlocks.length ? "warning" : "success"}
          />
          <ChecklistTile
            to="/owner/rooms"
            icon={Building2}
            label="Verify room truth"
            subtitle={locked ? `${locked} locked` : `${sellable} sellable`}
            accent={locked ? "destructive" : "success"}
          />
          <ChecklistTile
            to="/owner/visits"
            icon={Camera}
            label="Review TCM activity"
            subtitle={`${activeVisits.length} upcoming visits`}
            accent="default"
          />
        </div>
      </section>

      {/* INSIGHT SUMMARY */}
      {insight && (
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-sm font-semibold">
              Demand summary · {format(new Date(), "EEE, MMM d")}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Mini label="Leads pitched" value={insight.leadsPitched} />
            <Mini label="Visits done" value={insight.visitsDone} />
            <Mini label="High intent" value={insight.highIntent} />
            <Mini label="Top objection" value={insight.topObjection ?? "—"} small />
          </div>
          {insight.priceMismatchSignal && (
            <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning-foreground" />
              <span className="font-medium">Price signal:</span> {insight.priceMismatchSignal}
            </div>
          )}
          <Link to="/owner/insights" className="text-xs text-accent inline-flex items-center gap-1">
            View deep insights →
          </Link>
        </section>
      )}

      {/* DEMAND SIGNALS — objection bars */}
      {Object.keys(demandBars).length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            icon={TrendingUp}
            title="Demand signals"
            subtitle="Why deals don't close"
          />
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            {Object.entries(demandBars)
              .sort(([, a], [, b]) => b - a)
              .map(([reason, count]) => (
                <div key={reason} className="flex items-center gap-3">
                  <div className="text-sm w-32 font-medium">
                    {OBJECTION_LABELS[reason as keyof typeof OBJECTION_LABELS]}
                  </div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full", reason === "price" ? "bg-destructive" : "bg-warning")}
                      style={{ width: `${(count / myObjections.length) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs font-mono text-muted-foreground w-14 text-right">
                    {count}×
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* VACANCY FORECAST */}
      {forecast.length > 0 && (
        <section className="space-y-3">
          <SectionHeader icon={Calendar} title="Vacancy forecast" subtitle="Plan ahead" />
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {forecast.map(([date, items]) => (
              <div key={date} className="flex items-center gap-4 p-3">
                <div className="font-mono text-sm font-semibold w-24">{date}</div>
                <div className="text-xs text-muted-foreground flex-1 truncate">
                  {items
                    .map((s) => {
                      const r = myRooms.find((x) => x.id === s.roomId);
                      const p = properties.find((x) => x.id === s.propertyId);
                      return `${p?.name ?? "—"} ${r?.type ?? ""}`;
                    })
                    .join(" · ")}
                </div>
                <div className="text-[10px] font-mono text-warning-foreground bg-warning/10 border border-warning/30 px-2 py-0.5 rounded-full">
                  {items.length} room{items.length > 1 ? "s" : ""}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* LOCKED BANNER */}
      {locked > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-destructive text-sm">
              {locked} room{locked > 1 ? "s" : ""} auto-locked
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Not verified before 11 AM. Removed from sellable inventory. Update them now to bring
              them back online.
            </div>
            <Link
              to="/owner/rooms"
              className="inline-block mt-2 text-xs text-destructive font-medium"
            >
              Open rooms →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ───── primitives ─────
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  tone,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  tone?: "warning";
}) {
  return (
    <div className="flex items-end justify-between gap-2">
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "h-4 w-4",
            tone === "warning" ? "text-warning-foreground" : "text-muted-foreground",
          )}
        />
        <h2 className="font-display text-sm font-semibold">{title}</h2>
      </div>
      {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: any;
  label: string;
  value: number | string;
  sub: string;
  tone: "success" | "info" | "warning" | "danger";
}) {
  const t = {
    success: "border-success/30 text-success",
    info: "border-info/30 text-info",
    warning: "border-warning/30 text-warning-foreground",
    danger: "border-destructive/30 text-destructive",
  }[tone];
  return (
    <div className={cn("rounded-xl border bg-card p-3", t.split(" ")[0])}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", t.split(" ")[1])} />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
          {label}
        </span>
      </div>
      <div className="text-2xl font-display font-semibold tabular-nums mt-1">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function RevTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "warning";
}) {
  const c =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning-foreground"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
        {label}
      </div>
      <div className={cn("text-xl font-display font-semibold tabular-nums mt-1", c)}>{value}</div>
    </div>
  );
}

function Mini({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={small ? "text-xs font-medium" : "text-lg font-semibold"}>{value}</div>
    </div>
  );
}

function ChecklistTile({
  to,
  icon: Icon,
  label,
  subtitle,
  accent,
}: {
  to: string;
  icon: any;
  label: string;
  subtitle: string;
  accent: "default" | "warning" | "destructive" | "success";
}) {
  const border = {
    default: "border-border",
    warning: "border-warning/40",
    destructive: "border-destructive/40",
    success: "border-success/40",
  }[accent];
  return (
    <Link
      to={to}
      className={cn(
        "block rounded-xl border bg-card p-3 hover:border-accent/50 transition-colors",
        border,
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>
    </Link>
  );
}
