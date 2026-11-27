import {
  ALL_SKILLS,
  DorChecklist,
  Feature,
  Member,
  REFINEMENT_STAGES,
  RefinementStage,
  SkillTag,
  Sprint,
  Story,
  Team,
  WorkspaceData,
} from '../types/scrum';

export type CapacityHealthStatus = 'Nominal' | 'Near Limit' | 'Over-allocated' | 'Under-utilized';

export interface MemberTeamSlice {
  teamId: string;
  teamName: string;
  teamCode: string;
  allocationPercent: number;
  sprintAvailableHours: number;
  assignedHours: number;
  assignedPoints: number;
  stories: Story[];
}

export interface MemberCapacitySummary {
  member: Member;
  totalAllocationPercent: number;
  sprintTotalAvailableHours: number; // 2-week sprint = 2 * weeklyCapacityHours
  totalAllocatedHours: number;
  totalAssignedHours: number;
  totalAssignedPoints: number;
  utilizationPercent: number;
  status: CapacityHealthStatus;
  teamSlices: MemberTeamSlice[];
}

export interface TeamCapacitySummary {
  team: Team;
  memberCount: number;
  allocatedSprintHours: number;
  assignedHours: number;
  committedPoints: number;
  refiningPoints: number;
  readyPoints: number;
  utilizationPercent: number;
  status: CapacityHealthStatus;
}

export interface SkillSupplyDemand {
  skill: SkillTag;
  qualifiedMembers: number;
  supplyHours: number;
  demandHours: number;
  demandPoints: number;
  gapHours: number;
  status: 'Surplus' | 'Balanced' | 'Bottleneck';
}

export interface RefinementFunnelBucket {
  stage: RefinementStage;
  storyCount: number;
  totalPoints: number;
  totalHours: number;
  readyRatio: number;
}

export interface TreeStoryNode {
  id: string;
  title: string;
  points: number;
  hours: number;
  stage: RefinementStage;
  sprintId: string;
  requiredSkills: SkillTag[];
}

export interface TreeMemberNode {
  memberId: string;
  name: string;
  role: string;
  skills: SkillTag[];
  allocationPercentInTeam: number;
  totalAllocationPercent: number;
  allocatedHoursInTeam: number;
  assignedHoursInTeam: number;
  assignedPointsInTeam: number;
  totalAssignedHoursAllTeams: number;
  utilizationPercent: number;
  status: CapacityHealthStatus;
  otherTeams: { teamId: string; teamName: string; allocationPercent: number }[];
  stories: TreeStoryNode[];
}

export interface TreeTeamNode {
  team: Team;
  summary: TeamCapacitySummary;
  members: TreeMemberNode[];
}

export interface UserCentricTreeNode {
  summary: MemberCapacitySummary;
  teamBranches: MemberTeamSlice[];
}

export function getCapacityHealthStatus(utilizationPercent: number, allocationPercent = 100): CapacityHealthStatus {
  if (allocationPercent > 100 || utilizationPercent > 100) {
    return 'Over-allocated';
  }
  if (utilizationPercent >= 85) {
    return 'Near Limit';
  }
  if (utilizationPercent < 40 && allocationPercent > 0) {
    return 'Under-utilized';
  }
  return 'Nominal';
}

export function calculateMemberCapacitySummary(
  member: Member,
  teams: Team[],
  stories: Story[]
): MemberCapacitySummary {
  const sprintTotalAvailableHours = member.weeklyCapacityHours * 2;
  const totalAllocationPercent = member.teamAllocations.reduce(
    (sum, item) => sum + Math.max(0, item.allocationPercent),
    0
  );

  const memberStories = stories.filter((s) => s.assigneeId === member.id);
  const totalAssignedHours = memberStories.reduce((sum, s) => sum + s.estimatedHours, 0);
  const totalAssignedPoints = memberStories.reduce((sum, s) => sum + s.storyPoints, 0);

  const totalAllocatedHours = Math.round((sprintTotalAvailableHours * totalAllocationPercent) / 100);
  const effectiveCap = totalAllocatedHours > 0 ? totalAllocatedHours : sprintTotalAvailableHours;
  const utilizationPercent = effectiveCap > 0 ? Math.round((totalAssignedHours / effectiveCap) * 100) : 0;

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const teamSlices: MemberTeamSlice[] = member.teamAllocations.map((alloc) => {
    const team = teamMap.get(alloc.teamId);
    const sliceStories = memberStories.filter((s) => s.teamId === alloc.teamId);
    const sprintAvailableHours = Math.round((sprintTotalAvailableHours * alloc.allocationPercent) / 100);
    const assignedHours = sliceStories.reduce((sum, s) => sum + s.estimatedHours, 0);
    const assignedPoints = sliceStories.reduce((sum, s) => sum + s.storyPoints, 0);

    return {
      teamId: alloc.teamId,
      teamName: team?.name ?? 'Unknown Team',
      teamCode: team?.code ?? 'TEAM',
      allocationPercent: alloc.allocationPercent,
      sprintAvailableHours,
      assignedHours,
      assignedPoints,
      stories: sliceStories,
    };
  });

  return {
    member,
    totalAllocationPercent,
    sprintTotalAvailableHours,
    totalAllocatedHours,
    totalAssignedHours,
    totalAssignedPoints,
    utilizationPercent,
    status: getCapacityHealthStatus(utilizationPercent, totalAllocationPercent),
    teamSlices,
  };
}

export function calculateTeamCapacitySummary(
  team: Team,
  members: Member[],
  stories: Story[]
): TeamCapacitySummary {
  const teamMembers = members.filter((m) =>
    m.teamAllocations.some((a) => a.teamId === team.id && a.allocationPercent > 0)
  );

  const allocatedSprintHours = teamMembers.reduce((sum, m) => {
    const alloc = m.teamAllocations.find((a) => a.teamId === team.id);
    const pct = alloc ? alloc.allocationPercent : 0;
    return sum + Math.round((m.weeklyCapacityHours * 2 * pct) / 100);
  }, 0);

  const teamStories = stories.filter((s) => s.teamId === team.id);
  const committedStories = teamStories.filter((s) => s.sprintId !== '');
  const refiningStories = teamStories.filter((s) => s.refinementStage !== 'Ready for Sprint');
  const readyStories = teamStories.filter((s) => s.refinementStage === 'Ready for Sprint');

  const assignedHours = teamStories.reduce((sum, s) => sum + s.estimatedHours, 0);
  const committedPoints = committedStories.reduce((sum, s) => sum + s.storyPoints, 0);
  const refiningPoints = refiningStories.reduce((sum, s) => sum + s.storyPoints, 0);
  const readyPoints = readyStories.reduce((sum, s) => sum + s.storyPoints, 0);

  const utilizationPercent =
    team.sprintCapacityPoints > 0
      ? Math.round((committedPoints / team.sprintCapacityPoints) * 100)
      : 0;

  return {
    team,
    memberCount: teamMembers.length,
    allocatedSprintHours,
    assignedHours,
    committedPoints,
    refiningPoints,
    readyPoints,
    utilizationPercent,
    status: getCapacityHealthStatus(utilizationPercent),
  };
}

export function calculateSkillGapMatrix(
  members: Member[],
  stories: Story[],
  teamIdFilter?: string
): SkillSupplyDemand[] {
  const relevantStories = teamIdFilter ? stories.filter((s) => s.teamId === teamIdFilter) : stories;
  const relevantMembers = teamIdFilter
    ? members.filter((m) =>
        m.teamAllocations.some((a) => a.teamId === teamIdFilter && a.allocationPercent > 0)
      )
    : members;

  return ALL_SKILLS.map((skill) => {
    const skilledMembers = relevantMembers.filter((m) => m.skills.includes(skill));
    const supplyHours = skilledMembers.reduce((sum, m) => {
      const pct = teamIdFilter
        ? m.teamAllocations.find((a) => a.teamId === teamIdFilter)?.allocationPercent ?? 0
        : m.teamAllocations.reduce((acc, a) => acc + a.allocationPercent, 0);
      const effectivePct = Math.min(pct, 100);
      const skillShare = m.skills.length > 0 ? 1 / m.skills.length : 1;
      return sum + Math.round(((m.weeklyCapacityHours * 2 * effectivePct) / 100) * skillShare);
    }, 0);

    const skillStories = relevantStories.filter((s) => s.requiredSkills.includes(skill));
    const demandHours = skillStories.reduce((sum, s) => {
      const share = s.requiredSkills.length > 0 ? 1 / s.requiredSkills.length : 1;
      return sum + Math.round(s.estimatedHours * share);
    }, 0);
    const demandPoints = skillStories.reduce((sum, s) => sum + s.storyPoints, 0);

    const gapHours = supplyHours - demandHours;
    let status: 'Surplus' | 'Balanced' | 'Bottleneck' = 'Balanced';
    if (gapHours < 0) {
      status = 'Bottleneck';
    } else if (gapHours > 20) {
      status = 'Surplus';
    }

    return {
      skill,
      qualifiedMembers: skilledMembers.length,
      supplyHours,
      demandHours,
      demandPoints,
      gapHours,
      status,
    };
  });
}

export function calculateDorProgress(checklist: DorChecklist): {
  completed: number;
  total: number;
  percent: number;
  isReady: boolean;
} {
  const checks = [
    checklist.acceptanceCriteria,
    checklist.dependenciesCleared,
    checklist.sized,
    checklist.skillsMatched,
  ];
  const completed = checks.filter(Boolean).length;
  return {
    completed,
    total: 4,
    percent: Math.round((completed / 4) * 100),
    isReady: completed === 4,
  };
}

export function canAdvanceRefinementStage(
  story: Story,
  targetStage: RefinementStage
): { allowed: boolean; reason?: string } {
  if (!story.title.trim()) {
    return { allowed: false, reason: 'Story title is required.' };
  }
  if (targetStage === 'Triage & Sizing') {
    return { allowed: true };
  }
  if (targetStage === 'Skill & Capacity Fit') {
    if (story.storyPoints <= 0) {
      return { allowed: false, reason: 'Estimate story points (> 0) before matching skills and capacity.' };
    }
    if (story.requiredSkills.length === 0) {
      return { allowed: false, reason: 'Select at least one required skill before capacity matching.' };
    }
    return { allowed: true };
  }
  if (targetStage === 'Ready for Sprint') {
    if (story.storyPoints <= 0 || story.requiredSkills.length === 0) {
      return { allowed: false, reason: 'Story points and required skills must be set before marking Ready.' };
    }
    const dor = calculateDorProgress(story.dorChecklist);
    if (!dor.isReady) {
      return {
        allowed: false,
        reason: `Complete all 4 Definition of Ready items (${dor.completed}/4 completed).`,
      };
    }
    return { allowed: true };
  }
  return { allowed: true };
}

export function calculateRefinementFunnel(stories: Story[]): RefinementFunnelBucket[] {
  return REFINEMENT_STAGES.map((stage) => {
    const bucketStories = stories.filter((s) => s.refinementStage === stage);
    const totalPoints = bucketStories.reduce((sum, s) => sum + s.storyPoints, 0);
    const totalHours = bucketStories.reduce((sum, s) => sum + s.estimatedHours, 0);
    const readyCount = bucketStories.filter((s) => calculateDorProgress(s.dorChecklist).isReady).length;
    return {
      stage,
      storyCount: bucketStories.length,
      totalPoints,
      totalHours,
      readyRatio: bucketStories.length > 0 ? Math.round((readyCount / bucketStories.length) * 100) : 0,
    };
  });
}

export function buildCapacityTree(
  teams: Team[],
  members: Member[],
  stories: Story[]
): TreeTeamNode[] {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const memberSummaryMap = new Map(
    members.map((m) => [m.id, calculateMemberCapacitySummary(m, teams, stories)])
  );

  return teams.map((team) => {
    const summary = calculateTeamCapacitySummary(team, members, stories);
    const treeMembers: TreeMemberNode[] = members
      .filter((m) => m.teamAllocations.some((a) => a.teamId === team.id && a.allocationPercent > 0))
      .map((m) => {
        const memberSummary = memberSummaryMap.get(m.id)!;
        const alloc = m.teamAllocations.find((a) => a.teamId === team.id)!;
        const teamStories = stories.filter((s) => s.teamId === team.id && s.assigneeId === m.id);
        const assignedHoursInTeam = teamStories.reduce((sum, s) => sum + s.estimatedHours, 0);
        const assignedPointsInTeam = teamStories.reduce((sum, s) => sum + s.storyPoints, 0);
        const allocatedHoursInTeam = Math.round(
          (m.weeklyCapacityHours * 2 * alloc.allocationPercent) / 100
        );

        const otherTeams = m.teamAllocations
          .filter((a) => a.teamId !== team.id && a.allocationPercent > 0)
          .map((a) => ({
            teamId: a.teamId,
            teamName: teamMap.get(a.teamId)?.name ?? 'Other Team',
            allocationPercent: a.allocationPercent,
          }));

        return {
          memberId: m.id,
          name: m.name,
          role: m.role,
          skills: m.skills,
          allocationPercentInTeam: alloc.allocationPercent,
          totalAllocationPercent: memberSummary.totalAllocationPercent,
          allocatedHoursInTeam,
          assignedHoursInTeam,
          assignedPointsInTeam,
          totalAssignedHoursAllTeams: memberSummary.totalAssignedHours,
          utilizationPercent: memberSummary.utilizationPercent,
          status: memberSummary.status,
          otherTeams,
          stories: teamStories.map((s) => ({
            id: s.id,
            title: s.title,
            points: s.storyPoints,
            hours: s.estimatedHours,
            stage: s.refinementStage,
            sprintId: s.sprintId,
            requiredSkills: s.requiredSkills,
          })),
        };
      });

    return {
      team,
      summary,
      members: treeMembers,
    };
  });
}

export function buildUserCentricTree(
  teams: Team[],
  members: Member[],
  stories: Story[]
): UserCentricTreeNode[] {
  return members.map((member) => {
    const summary = calculateMemberCapacitySummary(member, teams, stories);
    return {
      summary,
      teamBranches: summary.teamSlices,
    };
  });
}

export function calculateSprintCapacityMetrics(
  sprint: Sprint,
  teams: Team[],
  stories: Story[],
  teamIdFilter?: string
) {
  const relevantTeams = teamIdFilter ? teams.filter((t) => t.id === teamIdFilter) : teams;
  const targetPoints = relevantTeams.reduce((sum, t) => sum + t.sprintCapacityPoints, 0);

  const sprintStories = stories.filter(
    (s) => s.sprintId === sprint.id && (!teamIdFilter || s.teamId === teamIdFilter)
  );
  const committedPoints = sprintStories.reduce((sum, s) => sum + s.storyPoints, 0);
  const committedHours = sprintStories.reduce((sum, s) => sum + s.estimatedHours, 0);
  const utilizationPercent = targetPoints > 0 ? Math.round((committedPoints / targetPoints) * 100) : 0;

  return {
    targetPoints,
    committedPoints,
    committedHours,
    storyCount: sprintStories.length,
    utilizationPercent,
    status: getCapacityHealthStatus(utilizationPercent),
  };
}

export function applySprintScopeSelection(
  stories: Story[],
  sprintId: string,
  selectedStoryIds: string[]
): { updatedStories: Story[]; changedStories: Story[] } {
  const selectedSet = new Set(selectedStoryIds);
  const changedStories: Story[] = [];

  const updatedStories = stories.map((story) => {
    const shouldBeInSprint = selectedSet.has(story.id);
    const isCurrentlyInSprint = story.sprintId === sprintId;

    if (shouldBeInSprint && !isCurrentlyInSprint) {
      const updated = { ...story, sprintId };
      changedStories.push(updated);
      return updated;
    }
    if (!shouldBeInSprint && isCurrentlyInSprint) {
      const updated = { ...story, sprintId: '' };
      changedStories.push(updated);
      return updated;
    }
    return story;
  });

  return { updatedStories, changedStories };
}

export function calculateSprintScopePreview(
  stories: Story[],
  teams: Team[],
  sprintId: string,
  selectedStoryIds: string[],
  teamIdFilter?: string
) {
  const relevantTeams = teamIdFilter ? teams.filter((t) => t.id === teamIdFilter) : teams;
  const targetPoints = relevantTeams.reduce((sum, t) => sum + t.sprintCapacityPoints, 0);

  const selectedSet = new Set(selectedStoryIds);
  const currentPoints = stories
    .filter((s) => s.sprintId === sprintId && (!teamIdFilter || s.teamId === teamIdFilter))
    .reduce((sum, s) => sum + s.storyPoints, 0);

  const nextStories = stories.filter(
    (s) => selectedSet.has(s.id) && (!teamIdFilter || s.teamId === teamIdFilter)
  );
  const committedPoints = nextStories.reduce((sum, s) => sum + s.storyPoints, 0);
  const committedHours = nextStories.reduce((sum, s) => sum + s.estimatedHours, 0);
  const utilizationPercent = targetPoints > 0 ? Math.round((committedPoints / targetPoints) * 100) : 0;

  return {
    targetPoints,
    committedPoints,
    committedHours,
    storyCount: nextStories.length,
    deltaPoints: committedPoints - currentPoints,
    utilizationPercent,
    status: getCapacityHealthStatus(utilizationPercent),
  };
}

export interface RemoveTeamChanges {
  updatedMembers: Member[];
  reassignedFeatures: Feature[];
  deletedFeatureIds: string[];
  reassignedStories: Story[];
  deletedStoryIds: string[];
}

export function removeTeamFromWorkspace(
  workspace: WorkspaceData,
  teamId: string,
  reassignToTeamId?: string
): { nextWorkspace: WorkspaceData; changes: RemoveTeamChanges } {
  const nextTeams = workspace.teams.filter((t) => t.id !== teamId);
  const validReassignId =
    reassignToTeamId &&
    reassignToTeamId !== teamId &&
    nextTeams.some((t) => t.id === reassignToTeamId)
      ? reassignToTeamId
      : undefined;

  const updatedMembers: Member[] = [];
  const nextMembers = workspace.members.map((member) => {
    if (!member.teamAllocations.some((a) => a.teamId === teamId)) {
      return member;
    }
    const updated: Member = {
      ...member,
      teamAllocations: member.teamAllocations.filter((a) => a.teamId !== teamId),
    };
    updatedMembers.push(updated);
    return updated;
  });

  const reassignedFeatures: Feature[] = [];
  const deletedFeatureIds: string[] = [];
  const nextFeatures: Feature[] = [];

  for (const feature of workspace.features) {
    if (feature.teamId !== teamId) {
      nextFeatures.push(feature);
    } else if (validReassignId) {
      const updated: Feature = { ...feature, teamId: validReassignId };
      reassignedFeatures.push(updated);
      nextFeatures.push(updated);
    } else {
      deletedFeatureIds.push(feature.id);
    }
  }

  const reassignedStories: Story[] = [];
  const deletedStoryIds: string[] = [];
  const nextStories: Story[] = [];

  for (const story of workspace.stories) {
    if (story.teamId !== teamId) {
      nextStories.push(story);
    } else if (validReassignId) {
      const updated: Story = { ...story, teamId: validReassignId };
      reassignedStories.push(updated);
      nextStories.push(updated);
    } else {
      deletedStoryIds.push(story.id);
    }
  }

  return {
    nextWorkspace: {
      ...workspace,
      teams: nextTeams,
      members: nextMembers,
      features: nextFeatures,
      stories: nextStories,
    },
    changes: {
      updatedMembers,
      reassignedFeatures,
      deletedFeatureIds,
      reassignedStories,
      deletedStoryIds,
    },
  };
}


