import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySprintScopeSelection,
  buildCapacityTree,
  buildUserCentricTree,
  calculateMemberCapacitySummary,
  calculateRefinementFunnel,
  calculateSkillGapMatrix,
  calculateSprintScopePreview,
  calculateTeamCapacitySummary,
  canAdvanceRefinementStage,
  removeTeamFromWorkspace,
} from './scrumMath';
import { Feature, Member, Story, Team, WorkspaceData } from '../types/scrum';

const sampleTeams: Team[] = [
  {
    id: 'team-core',
    name: 'Platform Core',
    code: 'CORE',
    leadName: 'Elena',
    sprintCapacityPoints: 30,
    focusArea: 'Auth & APIs',
  },
  {
    id: 'team-mob',
    name: 'Mobile Experience',
    code: 'MOB',
    leadName: 'Marcus',
    sprintCapacityPoints: 20,
    focusArea: 'iOS & Android',
  },
];

const sampleMembers: Member[] = [
  {
    id: 'm1',
    name: 'Alex Rivera',
    role: 'Staff Engineer',
    weeklyCapacityHours: 40, // 80h per sprint
    skills: ['Backend', 'DevOps'],
    teamAllocations: [
      { teamId: 'team-core', allocationPercent: 60 },
      { teamId: 'team-mob', allocationPercent: 50 }, // 110% over-allocated!
    ],
  },
  {
    id: 'm2',
    name: 'Priya Nair',
    role: 'Frontend Lead',
    weeklyCapacityHours: 40, // 80h per sprint
    skills: ['Frontend', 'Design'],
    teamAllocations: [
      { teamId: 'team-core', allocationPercent: 50 },
      { teamId: 'team-mob', allocationPercent: 50 },
    ],
  },
];

const sampleStories: Story[] = [
  {
    id: 's1',
    title: 'Implement OAuth Token Rotation',
    description: 'Rotate refresh tokens automatically',
    featureId: 'f1',
    teamId: 'team-core',
    sprintId: 'sp1',
    assigneeId: 'm1',
    refinementStage: 'Ready for Sprint',
    storyPoints: 8,
    estimatedHours: 32,
    priority: 'Critical',
    requiredSkills: ['Backend'],
    dorChecklist: {
      acceptanceCriteria: true,
      dependenciesCleared: true,
      sized: true,
      skillsMatched: true,
    },
    order: 1,
  },
  {
    id: 's2',
    title: 'Mobile Offline Sync Queue',
    description: 'Queue mutations offline',
    featureId: 'f2',
    teamId: 'team-mob',
    sprintId: '',
    assigneeId: 'm2',
    refinementStage: 'Triage & Sizing',
    storyPoints: 5,
    estimatedHours: 20,
    priority: 'High',
    requiredSkills: ['Frontend'],
    dorChecklist: {
      acceptanceCriteria: true,
      dependenciesCleared: false,
      sized: true,
      skillsMatched: false,
    },
    order: 2,
  },
];

test('detects cross-team over-allocation when allocation sum exceeds 100%', () => {
  const summary = calculateMemberCapacitySummary(sampleMembers[0], sampleTeams, sampleStories);
  assert.equal(summary.totalAllocationPercent, 110);
  assert.equal(summary.status, 'Over-allocated');
  assert.equal(summary.teamSlices.length, 2);
  assert.equal(summary.teamSlices[0].sprintAvailableHours, 48);
  assert.equal(summary.teamSlices[0].assignedPoints, 8);
});

test('computes team capacity summary accurately', () => {
  const coreSummary = calculateTeamCapacitySummary(sampleTeams[0], sampleMembers, sampleStories);
  assert.equal(coreSummary.memberCount, 2);
  assert.equal(coreSummary.allocatedSprintHours, 88); // 48 + 40
  assert.equal(coreSummary.committedPoints, 8);
  assert.equal(coreSummary.readyPoints, 8);
});

test('computes skill supply vs demand gap matrix', () => {
  const matrix = calculateSkillGapMatrix(sampleMembers, sampleStories);
  const backend = matrix.find((m) => m.skill === 'Backend')!;
  assert.equal(backend.qualifiedMembers, 1);
  assert.equal(backend.demandHours, 32);
  assert.equal(backend.demandPoints, 8);
});

test('enforces refinement stage gates and Definition of Ready', () => {
  const blocked = canAdvanceRefinementStage(sampleStories[1], 'Ready for Sprint');
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason ?? '', /Definition of Ready/);

  const readyOk = canAdvanceRefinementStage(sampleStories[0], 'Ready for Sprint');
  assert.equal(readyOk.allowed, true);
});

test('builds team-centric and user-centric capacity trees', () => {
  const teamTree = buildCapacityTree(sampleTeams, sampleMembers, sampleStories);
  assert.equal(teamTree.length, 2);
  assert.equal(teamTree[0].members.length, 2);
  assert.equal(teamTree[0].members[0].otherTeams.length, 1);

  const userTree = buildUserCentricTree(sampleTeams, sampleMembers, sampleStories);
  assert.equal(userTree.length, 2);
  assert.equal(userTree[0].teamBranches.length, 2);

  const funnel = calculateRefinementFunnel(sampleStories);
  assert.equal(funnel.find((f) => f.stage === 'Ready for Sprint')?.storyCount, 1);
});

test('updates sprint scope assignments and previews capacity delta', () => {
  const preview = calculateSprintScopePreview(
    sampleStories,
    sampleTeams,
    'sp1',
    ['s1', 's2']
  );
  assert.equal(preview.committedPoints, 13);
  assert.equal(preview.deltaPoints, 5);
  assert.equal(preview.storyCount, 2);

  const { updatedStories, changedStories } = applySprintScopeSelection(
    sampleStories,
    'sp1',
    ['s2']
  );
  assert.equal(changedStories.length, 2);
  assert.equal(updatedStories.find((s) => s.id === 's1')?.sprintId, '');
  assert.equal(updatedStories.find((s) => s.id === 's2')?.sprintId, 'sp1');
});

test('removes squad scope with member allocation cleanup and reassignment or cascade delete', () => {
  const sampleFeatures: Feature[] = [
    {
      id: 'f1',
      title: 'Auth Hardening',
      description: 'OAuth & passkeys',
      priority: 'Critical',
      targetQuarter: 'Q4',
      teamId: 'team-core',
      status: 'Refining',
    },
    {
      id: 'f2',
      title: 'Offline Sync',
      description: 'Mobile queue',
      priority: 'High',
      targetQuarter: 'Q4',
      teamId: 'team-mob',
      status: 'Discovery',
    },
  ];
  const workspace: WorkspaceData = {
    name: 'Test Org',
    teams: sampleTeams,
    members: sampleMembers,
    features: sampleFeatures,
    sprints: [],
    stories: sampleStories,
  };

  // Case 1: Reassign Platform Core stories & features to Mobile Experience
  const reassigned = removeTeamFromWorkspace(workspace, 'team-core', 'team-mob');
  assert.equal(reassigned.nextWorkspace.teams.length, 1);
  assert.equal(reassigned.nextWorkspace.teams[0].id, 'team-mob');
  assert.equal(reassigned.changes.updatedMembers.length, 2);
  assert.equal(
    reassigned.nextWorkspace.members[0].teamAllocations.some((a) => a.teamId === 'team-core'),
    false
  );
  assert.equal(reassigned.changes.reassignedFeatures.length, 1);
  assert.equal(reassigned.nextWorkspace.features.find((f) => f.id === 'f1')?.teamId, 'team-mob');
  assert.equal(reassigned.changes.reassignedStories.length, 1);
  assert.equal(reassigned.nextWorkspace.stories.find((s) => s.id === 's1')?.teamId, 'team-mob');

  // Case 2: Cascade delete when no reassignment target is provided
  const cascaded = removeTeamFromWorkspace(workspace, 'team-core');
  assert.equal(cascaded.nextWorkspace.teams.length, 1);
  assert.deepEqual(cascaded.changes.deletedFeatureIds, ['f1']);
  assert.deepEqual(cascaded.changes.deletedStoryIds, ['s1']);
  assert.equal(cascaded.nextWorkspace.features.length, 1);
  assert.equal(cascaded.nextWorkspace.stories.length, 1);
});


