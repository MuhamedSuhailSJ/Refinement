import React, { useEffect, useState } from 'react';
import { X, AlertCircle, CheckSquare, Square } from 'lucide-react';
import {
  ALL_SKILLS,
  Feature,
  Member,
  PriorityLevel,
  REFINEMENT_STAGES,
  RefinementStage,
  SkillTag,
  Sprint,
  Story,
  Team,
} from '../types/scrum';
import {
  calculateDorProgress,
  calculateMemberCapacitySummary,
  canAdvanceRefinementStage,
} from '../lib/scrumMath';

interface StoryModalProps {
  isOpen: boolean;
  story: Story | null; // null means creating a new story
  defaultFeatureId?: string;
  defaultTeamId?: string;
  features: Feature[];
  teams: Team[];
  members: Member[];
  sprints: Sprint[];
  stories: Story[];
  onClose: () => void;
  onSave: (story: Story, isNew: boolean) => void;
  onDelete?: (storyId: string) => void;
}

const FIBONACCI_POINTS = [0, 1, 2, 3, 5, 8, 13, 21];

export const StoryModal: React.FC<StoryModalProps> = ({
  isOpen,
  story,
  defaultFeatureId,
  defaultTeamId,
  features,
  teams,
  members,
  sprints,
  stories,
  onClose,
  onSave,
  onDelete,
}) => {
  const isNew = !story;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [featureId, setFeatureId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [sprintId, setSprintId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [refinementStage, setRefinementStage] = useState<RefinementStage>('Raw Intake');
  const [storyPoints, setStoryPoints] = useState<number>(3);
  const [estimatedHours, setEstimatedHours] = useState<number>(12);
  const [priority, setPriority] = useState<PriorityLevel>('Medium');
  const [requiredSkills, setRequiredSkills] = useState<SkillTag[]>(['Backend']);
  const [dorChecklist, setDorChecklist] = useState({
    acceptanceCriteria: false,
    dependenciesCleared: false,
    sized: false,
    skillsMatched: false,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    if (story) {
      setTitle(story.title);
      setDescription(story.description);
      setFeatureId(story.featureId);
      setTeamId(story.teamId);
      setSprintId(story.sprintId);
      setAssigneeId(story.assigneeId);
      setRefinementStage(story.refinementStage);
      setStoryPoints(story.storyPoints);
      setEstimatedHours(story.estimatedHours);
      setPriority(story.priority);
      setRequiredSkills(story.requiredSkills);
      setDorChecklist(story.dorChecklist);
    } else {
      const initialFeature = features.find((f) => f.id === defaultFeatureId) ?? features[0];
      const initialTeamId = defaultTeamId ?? initialFeature?.teamId ?? teams[0]?.id ?? '';
      setTitle('');
      setDescription('');
      setFeatureId(initialFeature?.id ?? '');
      setTeamId(initialTeamId);
      setSprintId('');
      setAssigneeId('');
      setRefinementStage('Raw Intake');
      setStoryPoints(3);
      setEstimatedHours(12);
      setPriority('Medium');
      setRequiredSkills(['Backend']);
      setDorChecklist({
        acceptanceCriteria: false,
        dependenciesCleared: false,
        sized: false,
        skillsMatched: false,
      });
    }
  }, [isOpen, story, defaultFeatureId, defaultTeamId, features, teams]);

  if (!isOpen) return null;

  const toggleSkill = (skill: SkillTag) => {
    setRequiredSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handlePointsChange = (pts: number) => {
    setStoryPoints(pts);
    if (pts > 0 && estimatedHours === 0) {
      setEstimatedHours(pts * 4);
    }
    if (pts > 0) {
      setDorChecklist((prev) => ({ ...prev, sized: true }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter a user story title.');
      return;
    }
    if (!featureId || !teamId) {
      setErrorMsg('Please select both a parent Feature and an owning Squad.');
      return;
    }

    const candidate: Story = {
      id: story?.id ?? `st-${Date.now().toString(36)}`,
      title: title.trim(),
      description: description.trim(),
      featureId,
      teamId,
      sprintId,
      assigneeId,
      refinementStage,
      storyPoints: Number(storyPoints) || 0,
      estimatedHours: Number(estimatedHours) || 0,
      priority,
      requiredSkills,
      dorChecklist,
      order: story?.order ?? stories.length + 1,
    };

    const gate = canAdvanceRefinementStage(candidate, refinementStage);
    if (!gate.allowed) {
      setErrorMsg(gate.reason ?? 'Cannot save story in this refinement stage.');
      return;
    }

    onSave(candidate, isNew);
    onClose();
  };

  const dorProgress = calculateDorProgress(dorChecklist);
  const teamMembers = members.filter((m) =>
    m.teamAllocations.some((a) => a.teamId === teamId && a.allocationPercent > 0)
  );
  const otherMembers = members.filter(
    (m) => !m.teamAllocations.some((a) => a.teamId === teamId && a.allocationPercent > 0)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="story-modal-title" className="text-base font-semibold text-slate-900">
              {isNew ? 'Create User Story for Refinement' : `Refine Story · ${story.id.toUpperCase()}`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Define scope, required skills, capacity estimate, and Definition of Ready
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close story dialog"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-5">
          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="story-title" className="block text-xs font-medium text-slate-700">
              Story Title *
            </label>
            <input
              id="story-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Implement SAML assertion validation middleware"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="story-desc" className="block text-xs font-medium text-slate-700">
              Acceptance Scope & Notes
            </label>
            <textarea
              id="story-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline technical boundaries, API contracts, and edge cases..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="story-feature" className="block text-xs font-medium text-slate-700">
                Parent Feature *
              </label>
              <select
                id="story-feature"
                value={featureId}
                onChange={(e) => setFeatureId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {features.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="story-team" className="block text-xs font-medium text-slate-700">
                Assigned Squad *
              </label>
              <select
                id="story-team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="story-stage" className="block text-xs font-medium text-slate-700">
                Refinement Stage
              </label>
              <select
                id="story-stage"
                value={refinementStage}
                onChange={(e) => setRefinementStage(e.target.value as RefinementStage)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {REFINEMENT_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="story-priority" className="block text-xs font-medium text-slate-700">
                Priority
              </label>
              <select
                id="story-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="story-sprint" className="block text-xs font-medium text-slate-700">
                Sprint Target
              </label>
              <select
                id="story-sprint"
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Backlog (Unscheduled)</option>
                {sprints.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name} ({sp.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-slate-700">
                Story Points (Fibonacci)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {FIBONACCI_POINTS.map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => handlePointsChange(pts)}
                    className={`px-2.5 py-1.5 text-xs font-mono rounded-md border transition-colors ${
                      storyPoints === pts
                        ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {pts}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="story-hours" className="block text-xs font-medium text-slate-700">
                Estimated Effort (Hours)
              </label>
              <input
                id="story-hours"
                type="number"
                min={0}
                max={240}
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-700">
              Required Skills
            </span>
            <div className="flex flex-wrap gap-2">
              {ALL_SKILLS.map((skill) => {
                const active = requiredSkills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    aria-pressed={active}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="story-assignee" className="block text-xs font-medium text-slate-700">
              Assignee (Matched by Squad & Live Capacity)
            </label>
            <select
              id="story-assignee"
              value={assigneeId}
              onChange={(e) => {
                setAssigneeId(e.target.value);
                if (e.target.value) {
                  setDorChecklist((prev) => ({ ...prev, skillsMatched: true }));
                }
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">Unassigned</option>
              {teamMembers.length > 0 && (
                <optgroup label="Assigned to Selected Squad">
                  {teamMembers.map((m) => {
                    const summary = calculateMemberCapacitySummary(m, teams, stories);
                    const skillMatch = requiredSkills.every((s) => m.skills.includes(s));
                    return (
                      <option key={m.id} value={m.id}>
                        {m.name} · {summary.utilizationPercent}% used · Skills: {m.skills.join(', ')}
                        {skillMatch ? ' [Exact Match]' : ''}
                      </option>
                    );
                  })}
                </optgroup>
              )}
              {otherMembers.length > 0 && (
                <optgroup label="Other Squad Members">
                  {otherMembers.map((m) => {
                    const summary = calculateMemberCapacitySummary(m, teams, stories);
                    return (
                      <option key={m.id} value={m.id}>
                        {m.name} · {summary.utilizationPercent}% used · {m.skills.join(', ')}
                      </option>
                    );
                  })}
                </optgroup>
              )}
            </select>
          </div>

          <div className="pt-2 border-t border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900">
                Definition of Ready Checklist
              </span>
              <span className="text-xs font-mono text-slate-600">
                {dorProgress.completed}/{dorProgress.total} ({dorProgress.percent}%)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { key: 'acceptanceCriteria' as const, label: 'Acceptance Criteria Defined' },
                { key: 'dependenciesCleared' as const, label: 'Dependencies Cleared' },
                { key: 'sized' as const, label: 'Story Points & Hours Sized' },
                { key: 'skillsMatched' as const, label: 'Skills & Capacity Matched' },
              ].map((item) => {
                const checked = dorChecklist[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setDorChecklist((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                    }
                    className={`flex items-center gap-2.5 px-3 py-2 text-left text-xs rounded-lg border transition-colors ${
                      checked
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-medium'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <div>
              {!isNew && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(story.id);
                    onClose();
                  }}
                  className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Delete Story
                </button>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {isNew ? 'Create Story' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
