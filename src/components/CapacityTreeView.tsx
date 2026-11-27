import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import { ALL_SKILLS, Member, SkillTag, Story, Team } from '../types/scrum';
import { buildCapacityTree, buildUserCentricTree } from '../lib/scrumMath';

interface CapacityTreeViewProps {
  teams: Team[];
  members: Member[];
  stories: Story[];
  selectedTeamId: string;
  onEditMember: (member: Member) => void;
  onCreateMember: () => void;
  onEditTeam: (team: Team) => void;
  onCreateTeam: () => void;
  onEditStory: (story: Story) => void;
}

type TreePerspective = 'by-user' | 'by-team';

export const CapacityTreeView: React.FC<CapacityTreeViewProps> = ({
  teams,
  members,
  stories,
  selectedTeamId,
  onEditMember,
  onCreateMember,
  onEditTeam,
  onCreateTeam,
  onEditStory,
}) => {
  const [perspective, setPerspective] = useState<TreePerspective>('by-user');
  const [searchQuery, setSearchQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState<SkillTag | ''>('');
  const [onlyOverAllocated, setOnlyOverAllocated] = useState(false);

  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  const storyMap = useMemo(() => new Map(stories.map((s) => [s.id, s])), [stories]);
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const userTree = useMemo(
    () => buildUserCentricTree(teams, members, stories),
    [teams, members, stories]
  );

  const teamTree = useMemo(
    () => buildCapacityTree(teams, members, stories),
    [teams, members, stories]
  );

  const toggleNode = (nodeId: string) => {
    setCollapsedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const expandAll = () => setCollapsedNodes({});

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    teams.forEach((t) => {
      next[`team-${t.id}`] = true;
    });
    members.forEach((m) => {
      next[`user-${m.id}`] = true;
      m.teamAllocations.forEach((a) => {
        next[`user-${m.id}-team-${a.teamId}`] = true;
        next[`team-${a.teamId}-mem-${m.id}`] = true;
      });
    });
    setCollapsedNodes(next);
  };

  const filteredUserNodes = userTree.filter((node) => {
    const m = node.summary.member;
    if (selectedTeamId && !m.teamAllocations.some((a) => a.teamId === selectedTeamId && a.allocationPercent > 0)) {
      return false;
    }
    if (skillFilter && !m.skills.includes(skillFilter)) return false;
    if (onlyOverAllocated && node.summary.status !== 'Over-allocated') return false;
    if (
      searchQuery.trim() &&
      !m.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !m.role.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const filteredTeamNodes = teamTree.filter((node) => {
    if (selectedTeamId && node.team.id !== selectedTeamId) return false;
    if (
      searchQuery.trim() &&
      !node.team.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !node.members.some((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Tree Controls Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Perspective Switcher */}
          <div className="flex items-center p-1 bg-slate-100 rounded-lg" role="tablist" aria-label="Capacity tree perspective">
            <button
              type="button"
              role="tab"
              aria-selected={perspective === 'by-user'}
              onClick={() => setPerspective('by-user')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                perspective === 'by-user'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              User → Teams Tree
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={perspective === 'by-team'}
              onClick={() => setPerspective('by-team')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                perspective === 'by-team'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Squad → Users Tree
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Search users or squads in capacity tree"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter user or squad..."
              className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 w-48"
            />
          </div>

          <select
            aria-label="Filter tree by skill"
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value as SkillTag | '')}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700"
          >
            <option value="">All Skills</option>
            {ALL_SKILLS.map((sk) => (
              <option key={sk} value={sk}>
                Skill: {sk}
              </option>
            ))}
          </select>

          <button
            type="button"
            aria-pressed={onlyOverAllocated}
            onClick={() => setOnlyOverAllocated((v) => !v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              onlyOverAllocated
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Over-allocated Only
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md"
          >
            Collapse All
          </button>
          <button
            type="button"
            onClick={onCreateTeam}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Users className="w-3.5 h-3.5" />
            Add Squad
          </button>
          <button
            type="button"
            onClick={onCreateMember}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Member
          </button>
        </div>
      </div>

      {/* Tree Viewport */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2 font-medium text-slate-900">
            <FolderKanban className="w-4 h-4 text-blue-600" />
            <span>
              {perspective === 'by-user'
                ? 'Organization Hierarchy · Contributors → Cross-Team Capacity → Assigned Stories'
                : 'Organization Hierarchy · Squads → Allocated Contributors → Assigned Stories'}
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">
            2-week sprint baseline (weekly hrs × 2)
          </span>
        </div>

        {perspective === 'by-user' ? (
          <div className="divide-y divide-slate-100" data-testid="user-capacity-tree">
            {filteredUserNodes.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <p className="text-sm font-medium text-slate-900">No contributors match your filter</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSkillFilter('');
                    setOnlyOverAllocated(false);
                  }}
                  className="text-xs font-medium text-blue-600 hover:underline"
                >
                  Reset Tree Filters
                </button>
              </div>
            ) : (
              filteredUserNodes.map(({ summary, teamBranches }) => {
                const m = summary.member;
                const userNodeId = `user-${m.id}`;
                const isUserExpanded = !collapsedNodes[userNodeId];

                return (
                  <div key={m.id} className="p-4">
                    {/* Level 1: User Node */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleNode(userNodeId)}
                          aria-expanded={isUserExpanded}
                          aria-label={`Toggle ${m.name} capacity branches`}
                          className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                        >
                          {isUserExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{m.name}</span>
                            <span className="text-xs text-slate-500">{m.role}</span>
                            {summary.status === 'Over-allocated' && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Over-allocated
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-500 font-mono">
                            Skills: {m.skills.join(', ')} · Base {m.weeklyCapacityHours}h/wk ({summary.sprintTotalAvailableHours}h/sprint)
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right font-mono text-xs">
                          <div className="text-slate-900 font-medium">
                            {summary.totalAllocationPercent}% allocated across {teamBranches.length}{' '}
                            {teamBranches.length === 1 ? 'team' : 'teams'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {summary.totalAssignedHours}h assigned / {summary.totalAllocatedHours}h cap ({summary.utilizationPercent}% used)
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onEditMember(m)}
                          aria-label={`Edit capacity for ${m.name}`}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
                        >
                          Adjust Split
                        </button>
                      </div>
                    </div>

                    {/* Level 2: Team Allocation Branches for this User */}
                    {isUserExpanded && (
                      <div className="mt-3 ml-5 pl-5 border-l border-slate-200 space-y-2.5">
                        {teamBranches.map((branch) => {
                          const branchId = `user-${m.id}-team-${branch.teamId}`;
                          const isBranchExpanded = !collapsedNodes[branchId];
                          const pctUsed =
                            branch.sprintAvailableHours > 0
                              ? Math.round((branch.assignedHours / branch.sprintAvailableHours) * 100)
                              : 0;

                          return (
                            <div key={branch.teamId} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleNode(branchId)}
                                    aria-expanded={isBranchExpanded}
                                    aria-label={`Toggle ${m.name} stories in ${branch.teamName}`}
                                    className="p-0.5 text-slate-500 hover:text-slate-900 rounded"
                                  >
                                    {isBranchExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <span className="font-mono text-[11px] font-semibold text-blue-700">
                                    {branch.teamCode}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-900">
                                    {branch.teamName}
                                  </span>
                                  <span className="text-slate-400" aria-hidden="true">·</span>
                                  <span className="text-xs font-mono text-slate-700">
                                    {branch.allocationPercent}% capacity ({branch.sprintAvailableHours}h)
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 text-xs font-mono">
                                  <span className="text-slate-600">
                                    {branch.stories.length} stories · {branch.assignedPoints} pts · {branch.assignedHours}h
                                  </span>
                                  <span
                                    className={
                                      pctUsed > 100
                                        ? 'text-red-700 font-semibold'
                                        : pctUsed >= 85
                                        ? 'text-amber-700 font-medium'
                                        : 'text-emerald-700'
                                    }
                                  >
                                    {pctUsed}% utilized
                                  </span>
                                </div>
                              </div>

                              {/* Level 3: Assigned Stories inside this Team */}
                              {isBranchExpanded && (
                                <div className="mt-2.5 ml-4 pl-4 border-l border-slate-200 space-y-1.5">
                                  {branch.stories.length === 0 ? (
                                    <div className="text-[11px] text-slate-400 py-1">
                                      No active stories assigned in {branch.teamName} ({branch.sprintAvailableHours}h open capacity)
                                    </div>
                                  ) : (
                                    branch.stories.map((st) => (
                                      <div
                                        key={st.id}
                                        className="flex items-center justify-between gap-3 py-1.5 px-2.5 rounded bg-white border border-slate-200/80 text-xs"
                                      >
                                        <button
                                          type="button"
                                          onClick={() => onEditStory(st)}
                                          className="text-left font-medium text-slate-800 hover:text-blue-600 truncate"
                                        >
                                          {st.title}
                                        </button>
                                        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 shrink-0">
                                          <span>{st.refinementStage}</span>
                                          <span aria-hidden="true">·</span>
                                          <span>{st.requiredSkills.join('/')}</span>
                                          <span aria-hidden="true">·</span>
                                          <span className="text-slate-900 font-medium">
                                            {st.storyPoints}p / {st.estimatedHours}h
                                          </span>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100" data-testid="team-capacity-tree">
            {filteredTeamNodes.map(({ team, summary, members: teamMembers }) => {
              const teamNodeId = `team-${team.id}`;
              const isTeamExpanded = !collapsedNodes[teamNodeId];

              const visibleMembers = teamMembers.filter((tm) => {
                if (skillFilter && !tm.skills.includes(skillFilter)) return false;
                if (onlyOverAllocated && tm.status !== 'Over-allocated') return false;
                return true;
              });

              return (
                <div key={team.id} className="p-4">
                  {/* Level 1: Squad Node */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => toggleNode(teamNodeId)}
                        aria-expanded={isTeamExpanded}
                        aria-label={`Toggle ${team.name} members`}
                        className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded"
                      >
                        {isTeamExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-blue-700">
                            {team.code}
                          </span>
                          <span className="text-sm font-semibold text-slate-900">{team.name}</span>
                          <span className="text-xs text-slate-500">Lead: {team.leadName}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{team.focusArea}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right font-mono text-xs">
                        <div className="text-slate-900 font-medium">
                          {summary.committedPoints}/{team.sprintCapacityPoints} pts ({summary.utilizationPercent}%)
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {visibleMembers.length} members · {summary.allocatedSprintHours}h allocated pool
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onEditTeam(team)}
                        aria-label={`Edit squad ${team.name}`}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                      >
                        Edit Squad
                      </button>
                    </div>
                  </div>

                  {/* Level 2: Member Nodes inside this Squad */}
                  {isTeamExpanded && (
                    <div className="mt-3 ml-5 pl-5 border-l border-slate-200 space-y-2.5">
                      {visibleMembers.length === 0 ? (
                        <div className="text-xs text-slate-400 py-2">
                          No squad members match the active skill or allocation filter
                        </div>
                      ) : (
                        visibleMembers.map((tm) => {
                        const memNodeId = `team-${team.id}-mem-${tm.memberId}`;
                        const isMemExpanded = !collapsedNodes[memNodeId];
                        const fullMember = memberMap.get(tm.memberId);

                        return (
                          <div key={tm.memberId} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleNode(memNodeId)}
                                  aria-expanded={isMemExpanded}
                                  aria-label={`Toggle ${tm.name} stories`}
                                  className="p-0.5 text-slate-500 hover:text-slate-900 rounded"
                                >
                                  {isMemExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <span className="text-xs font-semibold text-slate-900">{tm.name}</span>
                                <span className="text-xs text-slate-500">· {tm.skills.join(', ')}</span>
                                {tm.otherTeams.length > 0 && (
                                  <span className="text-[11px] font-mono text-slate-500">
                                    (Also: {tm.otherTeams.map((o) => `${o.teamName} ${o.allocationPercent}%`).join(', ')})
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-xs font-mono">
                                <span className="text-slate-700">
                                  {tm.allocationPercentInTeam}% here ({tm.allocatedHoursInTeam}h) · {tm.assignedHoursInTeam}h assigned
                                </span>
                                <span
                                  className={
                                    tm.status === 'Over-allocated'
                                      ? 'text-red-700 font-semibold'
                                      : 'text-emerald-700'
                                  }
                                >
                                  Total {tm.totalAllocationPercent}%
                                </span>
                                {fullMember && (
                                  <button
                                    type="button"
                                    onClick={() => onEditMember(fullMember)}
                                    className="text-blue-600 hover:underline font-sans font-medium"
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
                            </div>

                            {isMemExpanded && tm.stories.length > 0 && (
                              <div className="mt-2.5 ml-4 pl-4 border-l border-slate-200 space-y-1.5">
                                {tm.stories.map((st) => {
                                  const fullStory = storyMap.get(st.id);
                                  return (
                                    <div
                                      key={st.id}
                                      className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded bg-white border border-slate-200/80 text-xs"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => fullStory && onEditStory(fullStory)}
                                        className="text-left font-medium text-slate-800 hover:text-blue-600 truncate"
                                      >
                                        {st.title}
                                      </button>
                                      <span className="font-mono text-[11px] text-slate-600 shrink-0">
                                        {st.stage} · {st.points}p / {st.hours}h
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
