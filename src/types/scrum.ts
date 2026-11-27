export type SkillTag =
  | 'Frontend'
  | 'Backend'
  | 'DevOps'
  | 'QA'
  | 'Design'
  | 'Data';

export const ALL_SKILLS: SkillTag[] = [
  'Frontend',
  'Backend',
  'DevOps',
  'QA',
  'Design',
  'Data',
];

export type RefinementStage =
  | 'Raw Intake'
  | 'Triage & Sizing'
  | 'Skill & Capacity Fit'
  | 'Ready for Sprint';

export const REFINEMENT_STAGES: RefinementStage[] = [
  'Raw Intake',
  'Triage & Sizing',
  'Skill & Capacity Fit',
  'Ready for Sprint',
];

export type PriorityLevel = 'Critical' | 'High' | 'Medium' | 'Low';
export type FeatureStatus = 'Discovery' | 'Refining' | 'Ready' | 'In Delivery';
export type SprintStatus = 'Active' | 'Planned' | 'Horizon';

export interface DorChecklist {
  acceptanceCriteria: boolean;
  dependenciesCleared: boolean;
  sized: boolean;
  skillsMatched: boolean;
}

export interface Team {
  id: string;
  name: string;
  code: string;
  leadName: string;
  sprintCapacityPoints: number;
  focusArea: string;
}

export interface MemberTeamAllocation {
  teamId: string;
  allocationPercent: number; // e.g. 60 means 60% of weekly capacity
}

export interface Member {
  id: string;
  name: string;
  role: string;
  weeklyCapacityHours: number; // e.g. 40h/week -> 80h per 2-week sprint
  skills: SkillTag[];
  teamAllocations: MemberTeamAllocation[];
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  priority: PriorityLevel;
  targetQuarter: string;
  teamId: string;
  status: FeatureStatus;
}

export interface Sprint {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  order: number;
}

export interface Story {
  id: string;
  title: string;
  description: string;
  featureId: string;
  teamId: string;
  sprintId: string; // "" means in Refinement / Backlog
  assigneeId: string; // "" means unassigned
  refinementStage: RefinementStage;
  storyPoints: number;
  estimatedHours: number;
  priority: PriorityLevel;
  requiredSkills: SkillTag[];
  dorChecklist: DorChecklist;
  order: number;
}

export interface WorkspaceData {
  name: string;
  teams: Team[];
  members: Member[];
  features: Feature[];
  sprints: Sprint[];
  stories: Story[];
}
