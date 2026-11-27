import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FolderPlus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import {
  ALL_SKILLS,
  Feature,
  Member,
  REFINEMENT_STAGES,
  SkillTag,
  Story,
  Team,
} from '../types/scrum';
import { calculateDorProgress, canAdvanceRefinementStage } from '../lib/scrumMath';

interface RefinementLifecycleViewProps {
  teams: Team[];
  members: Member[];
  features: Feature[];
  stories: Story[];
  selectedTeamId: string;
  onCreateStory: (defaultFeatureId?: string) => void;
  onEditStory: (story: Story) => void;
  onCreateFeature: () => void;
  onEditFeature: (feature: Feature) => void;
  onUpdateStory: (story: Story) => void;
}

export const RefinementLifecycleView: React.FC<RefinementLifecycleViewProps> = ({
  teams,
  members,
  features,
  stories,
  selectedTeamId,
  onCreateStory,
  onEditStory,
  onCreateFeature,
  onEditFeature,
  onUpdateStory,
}) => {
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState<SkillTag | ''>('');
  const [gateError, setGateError] = useState<string | null>(null);

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const featureMap = new Map(features.map((f) => [f.id, f]));

  const visibleFeatures = features.filter(
    (f) => !selectedTeamId || f.teamId === selectedTeamId
  );

  const filteredStories = stories.filter((s) => {
    if (selectedTeamId && s.teamId !== selectedTeamId) return false;
    if (selectedFeatureId && s.featureId !== selectedFeatureId) return false;
    if (skillFilter && !s.requiredSkills.includes(skillFilter)) return false;
    if (
      searchQuery.trim() &&
      !s.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !s.id.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleAdvanceStage = (story: Story) => {
    const currentIndex = REFINEMENT_STAGES.indexOf(story.refinementStage);
    if (currentIndex < 0 || currentIndex >= REFINEMENT_STAGES.length - 1) return;
    const nextStage = REFINEMENT_STAGES[currentIndex + 1];
    const check = canAdvanceRefinementStage(story, nextStage);
    if (!check.allowed) {
      setGateError(`${story.title}: ${check.reason}`);
      onEditStory(story);
      return;
    }
    setGateError(null);
    onUpdateStory({ ...story, refinementStage: nextStage });
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Search stories in refinement"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stories by title or ID..."
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <select
              aria-label="Filter by required skill"
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
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCreateFeature}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            New Feature
          </button>
        </div>
      </div>

      {gateError && (
        <div
          role="alert"
          className="px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between"
        >
          <span>{gateError}</span>
          <button
            type="button"
            onClick={() => setGateError(null)}
            className="text-amber-800 font-medium underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Feature Selector Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-slate-700">
            Product Features ({visibleFeatures.length})
          </h2>
          {selectedFeatureId && (
            <button
              type="button"
              onClick={() => setSelectedFeatureId('')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Show All Features
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {visibleFeatures.map((feat) => {
            const featStories = stories.filter((s) => s.featureId === feat.id);
            const readyCount = featStories.filter(
              (s) => s.refinementStage === 'Ready for Sprint'
            ).length;
            const totalPts = featStories.reduce((sum, s) => sum + s.storyPoints, 0);
            const isSelected = selectedFeatureId === feat.id;
            const team = teamMap.get(feat.teamId);

            return (
              <div
                key={feat.id}
                className={`rounded-lg border p-3 transition-colors ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/40'
                    : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedFeatureId(isSelected ? '' : feat.id)
                    }
                    className="text-left flex-1 min-w-0"
                  >
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {feat.title}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                      <span>{team?.code ?? 'TEAM'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{feat.targetQuarter}</span>
                      <span aria-hidden="true">·</span>
                      <span>{feat.priority}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditFeature(feat)}
                    aria-label={`Edit feature ${feat.title}`}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-900 shrink-0"
                  >
                    Edit
                  </button>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-slate-600">
                  <span>
                    {readyCount}/{featStories.length} Ready
                  </span>
                  <span>{totalPts} pts</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4-Stage End-to-End Refinement Pipeline */}
      {filteredStories.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <p className="text-sm font-medium text-slate-900">
            No stories match the active refinement filters
          </p>
          <p className="text-xs text-slate-500">
            Clear your search or create a new story to begin refinement from scratch.
          </p>
          <div className="flex items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSkillFilter('');
                setSelectedFeatureId('');
              }}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={() => onCreateStory(selectedFeatureId || undefined)}
              className="px-3.5 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Create First Story
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {REFINEMENT_STAGES.map((stage, stageIdx) => {
            const stageStories = filteredStories.filter(
              (s) => s.refinementStage === stage
            );
            const stagePts = stageStories.reduce((sum, s) => sum + s.storyPoints, 0);

            return (
              <div
                key={stage}
                data-testid={`refinement-stage-${stageIdx}`}
                className="bg-white border border-slate-200 rounded-xl flex flex-col"
              >
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-slate-900">
                      0{stageIdx + 1}. {stage}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {stageStories.length} items · {stagePts} pts
                    </div>
                  </div>
                </div>

                <div className="p-3 space-y-2.5 min-h-[220px]">
                  {stageStories.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No stories in {stage}
                    </div>
                  ) : (
                    stageStories.map((story) => {
                      const feature = featureMap.get(story.featureId);
                      const team = teamMap.get(story.teamId);
                      const assignee = story.assigneeId
                        ? memberMap.get(story.assigneeId)
                        : null;
                      const dor = calculateDorProgress(story.dorChecklist);
                      const isLastStage = stageIdx === REFINEMENT_STAGES.length - 1;

                      return (
                        <div
                          key={story.id}
                          className="p-3 rounded-lg border border-slate-200 bg-slate-50/40 hover:bg-white hover:border-slate-300 transition-colors space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => onEditStory(story)}
                              className="text-left text-xs font-semibold text-slate-900 hover:text-blue-600 leading-snug"
                            >
                              {story.title}
                            </button>
                            <span className="font-mono text-[11px] font-semibold text-slate-700 shrink-0">
                              {story.storyPoints}p
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 truncate">
                            {feature?.title ?? 'Feature'} · {team?.code ?? 'TEAM'}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 font-mono">
                            <span>{story.estimatedHours}h</span>
                            <span aria-hidden="true">·</span>
                            <span>{story.requiredSkills.join(', ') || 'Unskilled'}</span>
                            <span aria-hidden="true">·</span>
                            <span>{dor.completed}/4 DoR</span>
                          </div>

                          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                            <div className="text-[11px] text-slate-700 font-medium truncate">
                              {assignee ? assignee.name : 'Unassigned'}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => onEditStory(story)}
                                aria-label={`Edit scope for '${story.title}'`}
                                className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors whitespace-nowrap"
                              >
                                Edit Scope
                              </button>

                              {!isLastStage ? (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceStage(story)}
                                  aria-label={`Advance '${story.title}' to next stage`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors whitespace-nowrap"
                                >
                                  Advance
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 whitespace-nowrap">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Ready
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
