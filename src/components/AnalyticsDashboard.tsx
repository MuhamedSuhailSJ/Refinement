import React from 'react';
import { ArrowUpRight, AlertTriangle, CheckCircle2, Layers } from 'lucide-react';
import { Feature, Member, Sprint, Story, Team } from '../types/scrum';
import {
  calculateMemberCapacitySummary,
  calculateRefinementFunnel,
  calculateSkillGapMatrix,
  calculateTeamCapacitySummary,
} from '../lib/scrumMath';

interface AnalyticsDashboardProps {
  teams: Team[];
  members: Member[];
  features: Feature[];
  sprints: Sprint[];
  stories: Story[];
  selectedTeamId: string;
  onNavigateView: (view: 'analytics' | 'refinement' | 'tree' | 'board') => void;
  onInspectStory: (story: Story) => void;
  onEditMember: (member: Member) => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  teams,
  members,
  features,
  stories,
  selectedTeamId,
  onNavigateView,
  onEditMember,
}) => {
  const filteredTeams = selectedTeamId ? teams.filter((t) => t.id === selectedTeamId) : teams;
  const filteredStories = selectedTeamId
    ? stories.filter((s) => s.teamId === selectedTeamId)
    : stories;

  const teamSummaries = filteredTeams.map((team) =>
    calculateTeamCapacitySummary(team, members, stories)
  );
  const memberSummaries = members
    .filter((m) =>
      !selectedTeamId || m.teamAllocations.some((a) => a.teamId === selectedTeamId && a.allocationPercent > 0)
    )
    .map((m) => calculateMemberCapacitySummary(m, teams, stories));

  const funnel = calculateRefinementFunnel(filteredStories);
  const skillMatrix = calculateSkillGapMatrix(members, stories, selectedTeamId || undefined);

  const totalPoints = filteredStories.reduce((sum, s) => sum + s.storyPoints, 0);
  const readyStories = filteredStories.filter((s) => s.refinementStage === 'Ready for Sprint');
  const readyPoints = readyStories.reduce((sum, s) => sum + s.storyPoints, 0);
  const committedPoints = filteredStories
    .filter((s) => s.sprintId !== '')
    .reduce((sum, s) => sum + s.storyPoints, 0);
  const targetCapacityPoints = filteredTeams.reduce((sum, t) => sum + t.sprintCapacityPoints, 0);
  const overallUtilization =
    targetCapacityPoints > 0 ? Math.round((committedPoints / targetCapacityPoints) * 100) : 0;

  const overAllocatedMembers = memberSummaries.filter((m) => m.status === 'Over-allocated');
  const maxBarPoints = Math.max(
    1,
    ...teamSummaries.map((ts) => Math.max(ts.team.sprintCapacityPoints, ts.committedPoints + ts.refiningPoints))
  );
  const maxSkillHours = Math.max(
    1,
    ...skillMatrix.map((sm) => Math.max(sm.supplyHours, sm.demandHours))
  );

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Refined &amp; Ready Scope</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold font-mono text-slate-900">
              {readyPoints} <span className="text-sm font-normal text-slate-500">pts</span>
            </span>
            <span className="text-xs font-mono text-emerald-700">
              {readyStories.length}/{filteredStories.length} stories
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {totalPoints} total pipeline pts across {features.length} features
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Sprint Committed Load</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold font-mono text-slate-900">
              {committedPoints} <span className="text-sm font-normal text-slate-500">/ {targetCapacityPoints} pts</span>
            </span>
            <span
              className={`text-xs font-mono font-medium ${
                overallUtilization > 100
                  ? 'text-red-700'
                  : overallUtilization >= 85
                  ? 'text-amber-700'
                  : 'text-blue-700'
              }`}
            >
              {overallUtilization}% load
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${
                overallUtilization > 100
                  ? 'bg-red-600'
                  : overallUtilization >= 85
                  ? 'bg-amber-500'
                  : 'bg-blue-600'
              }`}
              style={{ width: `${Math.min(100, overallUtilization)}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Multi-Team Capacity Alerts</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold font-mono text-slate-900">
              {overAllocatedMembers.length}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium ${
                overAllocatedMembers.length > 0 ? 'text-red-700' : 'text-emerald-700'
              }`}
            >
              {overAllocatedMembers.length > 0 ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Over-allocated
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Balanced
                </>
              )}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Monitoring {memberSummaries.length} contributors across {filteredTeams.length} squads
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Skill Bottlenecks</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold font-mono text-slate-900">
              {skillMatrix.filter((s) => s.status === 'Bottleneck').length}
            </span>
            <button
              type="button"
              onClick={() => onNavigateView('tree')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Open Tree
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-2 text-xs text-slate-500 truncate">
            {skillMatrix.filter((s) => s.status === 'Bottleneck').length > 0
              ? `Watch: ${skillMatrix
                  .filter((s) => s.status === 'Bottleneck')
                  .map((s) => s.skill)
                  .join(', ')}`
              : 'All 6 core skills within sprint capacity'}
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Team Capacity vs Committed & Pipeline Chart */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Squad Capacity vs. Committed &amp; Refining Load
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time story point distribution against squad sprint capacity targets
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateView('board')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
            >
              Plan Sprints
            </button>
          </div>

          <div className="mt-5 space-y-4 flex-1">
            {teamSummaries.map((ts) => {
              const targetW = Math.round((ts.team.sprintCapacityPoints / maxBarPoints) * 100);
              const committedW = Math.round((ts.committedPoints / maxBarPoints) * 100);
              const refiningW = Math.round((ts.refiningPoints / maxBarPoints) * 100);

              return (
                <div key={ts.team.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] font-semibold text-slate-500 w-10 shrink-0">
                        {ts.team.code}
                      </span>
                      <span className="font-medium text-slate-900 truncate">{ts.team.name}</span>
                      <span className="text-slate-400" aria-hidden="true">·</span>
                      <span className="text-slate-500 font-mono">{ts.memberCount} members</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono shrink-0">
                      <span className="text-slate-700">
                        {ts.committedPoints}/{ts.team.sprintCapacityPoints} pts
                      </span>
                      <span
                        className={
                          ts.status === 'Over-allocated'
                            ? 'text-red-700 font-semibold'
                            : ts.status === 'Near Limit'
                            ? 'text-amber-700 font-medium'
                            : 'text-emerald-700'
                        }
                      >
                        {ts.utilizationPercent}%
                      </span>
                    </div>
                  </div>

                  {/* SVG Stacked Capacity Bar with Target Marker */}
                  <svg
                    viewBox="0 0 400 20"
                    className="w-full h-5 overflow-visible"
                    role="img"
                    aria-label={`${ts.team.name}: ${ts.committedPoints} committed points, ${ts.refiningPoints} refining points, target ${ts.team.sprintCapacityPoints} points`}
                  >
                    <rect x="0" y="3" width="400" height="14" rx="3" fill="#f1f5f9" />
                    <rect
                      x="0"
                      y="3"
                      width={Math.min(400, (committedW / 100) * 400)}
                      height="14"
                      rx="3"
                      fill={ts.utilizationPercent > 100 ? '#dc2626' : '#2563eb'}
                    />
                    <rect
                      x={Math.min(400, (committedW / 100) * 400)}
                      y="3"
                      width={Math.max(0, Math.min(400 - (committedW / 100) * 400, (refiningW / 100) * 400))}
                      height="14"
                      rx="2"
                      fill="#93c5fd"
                    />
                    <line
                      x1={(targetW / 100) * 400}
                      y1="0"
                      x2={(targetW / 100) * 400}
                      y2="20"
                      stroke="#0f172a"
                      strokeWidth="2"
                      strokeDasharray="2 2"
                    />
                  </svg>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-5 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-xs bg-blue-600 inline-block" />
              Committed to Sprint
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-xs bg-blue-300 inline-block" />
              In Refinement
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-slate-900 inline-block" />
              Sprint Capacity Target
            </span>
          </div>
        </section>

        {/* Refinement Pipeline Funnel */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Refinement Funnel (Scratch to Ready)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Story throughput and Definition of Ready progression
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateView('refinement')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
            >
              Open Pipeline
            </button>
          </div>

          <div className="mt-4 space-y-3 flex-1">
            {funnel.map((bucket, idx) => {
              const widthPct =
                filteredStories.length > 0
                  ? Math.max(8, Math.round((bucket.storyCount / filteredStories.length) * 100))
                  : 0;
              return (
                <div key={bucket.stage} className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-900">
                      0{idx + 1}. {bucket.stage}
                    </span>
                    <span className="font-mono text-slate-600">
                      {bucket.storyCount} stories · {bucket.totalPoints} pts
                    </span>
                  </div>
                  <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        bucket.stage === 'Ready for Sprint' ? 'bg-emerald-600' : 'bg-slate-700'
                      }`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>{bucket.totalHours} est. hours</span>
                    <span>{bucket.readyRatio}% DoR complete</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Bottom Row: Skill Supply vs Demand + Cross-Team User Load */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">
              Skill Supply vs. Story Demand
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Estimated sprint hours available per skill versus active backlog demand
            </p>
          </div>

          <div className="mt-4 space-y-3.5">
            {skillMatrix.map((row) => {
              const supplyW = Math.round((row.supplyHours / maxSkillHours) * 100);
              const demandW = Math.round((row.demandHours / maxSkillHours) * 100);
              return (
                <div key={row.skill} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 w-16">{row.skill}</span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {row.qualifiedMembers} specialists
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 font-mono">
                      <span className="text-slate-600">
                        {row.demandHours}h req / {row.supplyHours}h cap
                      </span>
                      <span
                        className={`font-medium ${
                          row.status === 'Bottleneck'
                            ? 'text-red-700'
                            : row.status === 'Surplus'
                            ? 'text-emerald-700'
                            : 'text-slate-700'
                        }`}
                      >
                        {row.status}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-800 transition-all duration-200"
                        style={{ width: `${supplyW}%` }}
                        title={`Supply: ${row.supplyHours}h`}
                      />
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${row.status === 'Bottleneck' ? 'bg-red-600' : 'bg-blue-600'}`}
                        style={{ width: `${demandW}%` }}
                        title={`Demand: ${row.demandHours}h`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2 bg-slate-800 inline-block rounded-xs" /> Supply Hours
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2 bg-blue-600 inline-block rounded-xs" /> Demand Hours
            </span>
          </div>
        </section>

        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Cross-Team Member Capacity Monitor
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Live breakdown of each user&apos;s team split, assigned hours, and utilization health
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateView('tree')}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              <Layers className="w-3.5 h-3.5" />
              View Tree
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                  <th className="py-2 pr-3">Member</th>
                  <th className="py-2 px-3">Team Allocations</th>
                  <th className="py-2 px-3 text-right">Assigned</th>
                  <th className="py-2 px-3 text-right">Utilization</th>
                  <th className="py-2 pl-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {memberSummaries.map((ms) => (
                  <tr key={ms.member.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pr-3">
                      <button
                        type="button"
                        onClick={() => onEditMember(ms.member)}
                        className="text-left group"
                      >
                        <div className="font-medium text-slate-900 group-hover:text-blue-600">
                          {ms.member.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {ms.member.skills.join(' · ')}
                        </div>
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                      {ms.teamSlices
                        .map((sl) => `${sl.teamCode} ${sl.allocationPercent}%`)
                        .join(' / ')}
                      <span className="ml-1.5 text-slate-400">
                        ({ms.totalAllocationPercent}%)
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {ms.totalAssignedHours}h / {ms.totalAllocatedHours}h
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-medium">
                      {ms.utilizationPercent}%
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <span
                        className={`font-medium ${
                          ms.status === 'Over-allocated'
                            ? 'text-red-700'
                            : ms.status === 'Near Limit'
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {ms.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
